use std::collections::HashMap;
use std::fmt;
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::prelude::*;
use reqwest::blocking::{multipart, Client as HttpClient};
use reqwest::header::{HeaderName, HeaderValue};
use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use tungstenite::client::IntoClientRequest;
use tungstenite::{connect, Message};
use url::form_urlencoded::Serializer;

const DEFAULT_REST_PATH: &str = "/api/v1/transform";
const DEFAULT_REST_FIELD: &str = "image";
const DEFAULT_RPC_PATH: &str = "/rpc";
const DEFAULT_RPC_METHOD: &str = "image.transform";

const OPERATION_ORDER: &[&str] = &[
    "width",
    "height",
    "dpr",
    "aspectRatio",
    "fit",
    "background",
    "smartCrop",
    "crop",
    "cropOffset",
    "autoOrient",
    "rotate",
    "flip",
    "blur",
    "sharpen",
    "oilPaint",
    "brightness",
    "contrast",
    "saturation",
    "exposure",
    "hue",
    "gamma",
    "colorize",
    "sepia",
    "invert",
    "threshold",
    "r",
    "g",
    "b",
    "grayscale",
    "removeAlpha",
    "ensureAlpha",
    "convertTo",
    "quality",
    "progressive",
    "stripMetadata",
];

const SUPPORTED_FORMATS: &[&str] = &["webp", "png", "jpg", "jpeg", "avif", "gif", "heif"];
const FIT_MODES: &[&str] = &["cover", "contain", "fill", "inside", "outside"];

pub type Result<T> = std::result::Result<T, SharptownError>;

#[derive(Debug, Clone)]
pub struct SharptownError {
    pub message: String,
    pub status: Option<i32>,
    pub body: Option<JsonValue>,
}

impl SharptownError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            status: None,
            body: None,
        }
    }

    pub fn with_status(message: impl Into<String>, status: i32, body: Option<JsonValue>) -> Self {
        Self {
            message: message.into(),
            status: Some(status),
            body,
        }
    }
}

impl fmt::Display for SharptownError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for SharptownError {}

impl From<std::io::Error> for SharptownError {
    fn from(value: std::io::Error) -> Self {
        Self::new(value.to_string())
    }
}

impl From<reqwest::Error> for SharptownError {
    fn from(value: reqwest::Error) -> Self {
        Self::new(value.to_string())
    }
}

impl From<tungstenite::Error> for SharptownError {
    fn from(value: tungstenite::Error) -> Self {
        Self::new(value.to_string())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum OperationValue {
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
}

impl OperationValue {
    fn query_value(&self) -> String {
        match self {
            Self::Bool(true) => "true".to_string(),
            Self::Bool(false) => "false".to_string(),
            Self::Int(value) => value.to_string(),
            Self::Float(value) => value.to_string(),
            Self::String(value) => value.clone(),
        }
    }

    fn json_value(&self) -> JsonValue {
        match self {
            Self::Bool(value) => JsonValue::Bool(*value),
            Self::Int(value) => JsonValue::from(*value),
            Self::Float(value) => JsonValue::from(*value),
            Self::String(value) => JsonValue::String(value.clone()),
        }
    }
}

pub type Operations = HashMap<String, OperationValue>;

pub enum Input {
    Bytes {
        data: Vec<u8>,
        filename: String,
    },
    Path(PathBuf),
    Url {
        url: String,
        filename: String,
    },
    Reader {
        reader: Box<dyn Read + Send>,
        filename: String,
    },
}

impl Input {
    pub fn bytes(data: impl Into<Vec<u8>>, filename: impl Into<String>) -> Self {
        Self::Bytes {
            data: data.into(),
            filename: or_default(filename.into(), "image"),
        }
    }

    pub fn path(path: impl Into<PathBuf>) -> Self {
        Self::Path(path.into())
    }

    pub fn url(url: impl Into<String>) -> Self {
        let url = url.into();
        let filename = filename_from_url(&url).unwrap_or_else(|| "image".to_string());
        Self::Url { url, filename }
    }

    pub fn reader(reader: impl Read + Send + 'static, filename: impl Into<String>) -> Self {
        Self::Reader {
            reader: Box::new(reader),
            filename: or_default(filename.into(), "image"),
        }
    }

    fn open(self, http: &HttpClient) -> Result<OpenedInput> {
        match self {
            Self::Bytes { data, filename } => {
                let length = data.len() as u64;
                Ok(OpenedInput {
                    reader: Box::new(Cursor::new(data)),
                    filename: filename.clone(),
                    content_type: guess_content_type(&filename),
                    length: Some(length),
                })
            }
            Self::Path(path) => {
                let file = File::open(&path)?;
                let length = file.metadata().ok().map(|metadata| metadata.len());
                let filename = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("image")
                    .to_string();
                Ok(OpenedInput {
                    reader: Box::new(file),
                    content_type: guess_content_type(&filename),
                    filename,
                    length,
                })
            }
            Self::Url { url, filename } => {
                let response = http.get(&url).send().map_err(|err| {
                    SharptownError::new(format!("failed to fetch input from {url}: {err}"))
                })?;
                let status = response.status();
                if !status.is_success() {
                    return Err(SharptownError::with_status(
                        format!("failed to fetch input from {url}: {}", status.as_u16()),
                        i32::from(status.as_u16()),
                        None,
                    ));
                }
                let length = response.content_length();
                Ok(OpenedInput {
                    reader: Box::new(response),
                    filename: filename.clone(),
                    content_type: guess_content_type(&filename),
                    length,
                })
            }
            Self::Reader { reader, filename } => Ok(OpenedInput {
                reader,
                filename: filename.clone(),
                content_type: guess_content_type(&filename),
                length: None,
            }),
        }
    }
}

struct OpenedInput {
    reader: Box<dyn Read + Send>,
    filename: String,
    content_type: String,
    length: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Response {
    pub fn content_type(&self) -> Option<&str> {
        self.headers
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case("content-type"))
            .map(|(_, value)| value.as_str())
    }

    pub fn save(&self, path: impl AsRef<Path>) -> Result<()> {
        fs::write(path, &self.body)?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct RestTransport {
    path: String,
    field: String,
}

impl Default for RestTransport {
    fn default() -> Self {
        Self {
            path: DEFAULT_REST_PATH.to_string(),
            field: DEFAULT_REST_FIELD.to_string(),
        }
    }
}

impl RestTransport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = path.into();
        self
    }

    pub fn with_field(mut self, field: impl Into<String>) -> Self {
        self.field = field.into();
        self
    }
}

#[derive(Debug, Clone)]
pub struct JsonRpcTransport {
    path: String,
    method: String,
}

impl Default for JsonRpcTransport {
    fn default() -> Self {
        Self {
            path: DEFAULT_RPC_PATH.to_string(),
            method: DEFAULT_RPC_METHOD.to_string(),
        }
    }
}

impl JsonRpcTransport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = path.into();
        self
    }

    pub fn with_method(mut self, method: impl Into<String>) -> Self {
        self.method = method.into();
        self
    }
}

#[derive(Debug, Clone)]
pub enum Transport {
    Rest(RestTransport),
    JsonRpc(JsonRpcTransport),
}

impl Default for Transport {
    fn default() -> Self {
        Self::Rest(RestTransport::default())
    }
}

impl Transport {
    pub fn rest() -> Self {
        Self::Rest(RestTransport::default())
    }

    pub fn jsonrpc() -> Self {
        Self::JsonRpc(JsonRpcTransport::default())
    }
}

#[derive(Debug, Clone)]
pub struct Client {
    base_url: String,
    http: HttpClient,
    headers: Vec<(String, String)>,
    transport: Transport,
}

impl Client {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: trim_base(base_url.into()),
            http: HttpClient::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("reqwest blocking client should build with default configuration"),
            headers: Vec::new(),
            transport: Transport::default(),
        }
    }

    pub fn with_http_client(mut self, http: HttpClient) -> Self {
        self.http = http;
        self
    }

    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((key.into(), value.into()));
        self
    }

    pub fn with_headers<I, K, V>(mut self, headers: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        self.headers.extend(
            headers
                .into_iter()
                .map(|(key, value)| (key.into(), value.into())),
        );
        self
    }

    pub fn with_transport(mut self, transport: Transport) -> Self {
        self.transport = transport;
        self
    }

    pub fn with_rest_transport(mut self, transport: RestTransport) -> Self {
        self.transport = Transport::Rest(transport);
        self
    }

    pub fn with_jsonrpc_transport(mut self, transport: JsonRpcTransport) -> Self {
        self.transport = Transport::JsonRpc(transport);
        self
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn transform(&self, input: Input) -> Transform<'_> {
        Transform {
            client: self,
            input,
            ops: Operations::new(),
            err: None,
        }
    }
}

pub struct Transform<'a> {
    client: &'a Client,
    input: Input,
    ops: Operations,
    err: Option<SharptownError>,
}

impl<'a> Transform<'a> {
    pub fn operations(&self) -> &Operations {
        &self.ops
    }

    pub fn err(&self) -> Option<&SharptownError> {
        self.err.as_ref()
    }

    pub fn resize(self, width: i64, height: i64) -> Self {
        self.width(width).height(height)
    }

    pub fn width(self, value: i64) -> Self {
        self.put_uint("width", value, "width")
    }

    pub fn height(self, value: i64) -> Self {
        self.put_uint("height", value, "height")
    }

    pub fn crop(mut self, left: i64, top: i64, width: i64, height: i64) -> Self {
        if self.err.is_some() {
            return self;
        }
        for (name, value) in [
            ("crop.left", left),
            ("crop.top", top),
            ("crop.width", width),
            ("crop.height", height),
        ] {
            if value < 0 {
                return self.fail(format!(
                    "invalid {name}: expected a non-negative integer, got {value}"
                ));
            }
        }
        self.ops.insert(
            "crop".to_string(),
            OperationValue::String(format!("{left},{top},{width},{height}")),
        );
        self
    }

    pub fn smart_crop(self) -> Self {
        self.set("smartCrop", OperationValue::Bool(true))
    }

    pub fn fit(self, mode: impl AsRef<str>) -> Self {
        let mode = mode.as_ref().to_lowercase();
        if !FIT_MODES.contains(&mode.as_str()) {
            return self.fail(format!(
                "unsupported fit {:?}. Supported: {}",
                mode,
                FIT_MODES.join(", ")
            ));
        }
        self.set("fit", OperationValue::String(mode))
    }

    pub fn background(self, color: impl Into<String>) -> Self {
        self.set("background", OperationValue::String(color.into()))
    }

    pub fn dpr(self, value: f64) -> Self {
        self.put_range("dpr", value, "dpr", 0.1, 5.0)
    }

    pub fn aspect_ratio(self, value: f64) -> Self {
        self.put_range("aspectRatio", value, "aspectRatio", 0.0001, 1000.0)
    }

    pub fn auto_orient(self) -> Self {
        self.set("autoOrient", OperationValue::Bool(true))
    }

    pub fn rotate(self, degrees: i64) -> Self {
        self.set("rotate", OperationValue::Int(degrees))
    }

    pub fn flip(self) -> Self {
        self.set("flip", OperationValue::Bool(true))
    }

    pub fn blur(self, sigma: i64) -> Self {
        self.put_uint("blur", sigma, "blur")
    }

    pub fn tint(self, r: i64, g: i64, b: i64) -> Self {
        self.put_color("r", r, "r")
            .put_color("g", g, "g")
            .put_color("b", b, "b")
    }

    pub fn grayscale(self) -> Self {
        self.set("grayscale", OperationValue::Bool(true))
    }

    pub fn greyscale(self) -> Self {
        self.grayscale()
    }

    pub fn remove_alpha(self) -> Self {
        self.set("removeAlpha", OperationValue::Bool(true))
    }

    pub fn ensure_alpha(self) -> Self {
        self.set("ensureAlpha", OperationValue::Bool(true))
    }

    pub fn brightness(self, value: f64) -> Self {
        self.put_range("brightness", value, "brightness", -100.0, 100.0)
    }

    pub fn contrast(self, value: f64) -> Self {
        self.put_range("contrast", value, "contrast", -100.0, 100.0)
    }

    pub fn saturation(self, value: f64) -> Self {
        self.put_range("saturation", value, "saturation", 0.0, 2.0)
    }

    pub fn exposure(self, value: f64) -> Self {
        self.put_range("exposure", value, "exposure", -3.0, 3.0)
    }

    pub fn hue(self, value: f64) -> Self {
        self.put_range("hue", value, "hue", 0.0, 360.0)
    }

    pub fn gamma(self, value: f64) -> Self {
        self.put_range("gamma", value, "gamma", 1.0, 3.0)
    }

    pub fn colorize(self, color: impl Into<String>) -> Self {
        self.set("colorize", OperationValue::String(color.into()))
    }

    pub fn sepia(self, intensity: f64) -> Self {
        self.put_range("sepia", intensity, "sepia", 0.0, 1.0)
    }

    pub fn invert(self) -> Self {
        self.set("invert", OperationValue::Bool(true))
    }

    pub fn threshold(self, value: i64) -> Self {
        self.put_int_range("threshold", value, "threshold", 0, 255)
    }

    pub fn sharpen(self, sigma: f64) -> Self {
        self.put_range("sharpen", sigma, "sharpen", 0.0, 5.0)
    }

    pub fn oil_paint(self, size: i64) -> Self {
        self.put_int_range("oilPaint", size, "oilPaint", 1, 25)
    }

    pub fn quality(self, value: i64) -> Self {
        self.put_int_range("quality", value, "quality", 1, 100)
    }

    pub fn progressive(self) -> Self {
        self.set("progressive", OperationValue::Bool(true))
    }

    pub fn strip_metadata(self) -> Self {
        self.set("stripMetadata", OperationValue::Bool(true))
    }

    pub fn keep_metadata(self) -> Self {
        self.set("stripMetadata", OperationValue::Bool(false))
    }

    pub fn convert(self, format: impl AsRef<str>) -> Self {
        let format = format.as_ref().to_lowercase();
        if !SUPPORTED_FORMATS.contains(&format.as_str()) {
            return self.fail(format!(
                "unsupported format {:?}. Supported: {}",
                format,
                SUPPORTED_FORMATS.join(", ")
            ));
        }
        self.set("convertTo", OperationValue::String(format))
    }

    pub fn to_format(self, format: impl AsRef<str>) -> Self {
        self.convert(format)
    }

    pub fn response(self) -> Result<Response> {
        if let Some(err) = self.err {
            return Err(err);
        }
        match &self.client.transport {
            Transport::Rest(transport) => {
                transform_rest(self.client, transport, self.input, &self.ops)
            }
            Transport::JsonRpc(transport) => {
                transform_jsonrpc(self.client, transport, self.input, &self.ops)
            }
        }
    }

    pub fn bytes(self) -> Result<Vec<u8>> {
        Ok(self.response()?.body)
    }

    pub fn save(self, path: impl AsRef<Path>) -> Result<()> {
        self.response()?.save(path)
    }

    fn set(mut self, key: &str, value: OperationValue) -> Self {
        if self.err.is_none() {
            self.ops.insert(key.to_string(), value);
        }
        self
    }

    fn fail(mut self, message: impl Into<String>) -> Self {
        if self.err.is_none() {
            self.err = Some(SharptownError::new(message.into()));
        }
        self
    }

    fn put_uint(self, key: &str, value: i64, field: &str) -> Self {
        if value < 0 {
            return self.fail(format!(
                "invalid {field}: expected a non-negative integer, got {value}"
            ));
        }
        self.set(key, OperationValue::Int(value))
    }

    fn put_color(self, key: &str, value: i64, field: &str) -> Self {
        if !(0..=255).contains(&value) {
            return self.fail(format!("invalid {field}: expected 0-255, got {value}"));
        }
        self.set(key, OperationValue::Int(value))
    }

    fn put_int_range(self, key: &str, value: i64, field: &str, min: i64, max: i64) -> Self {
        if value < min || value > max {
            return self.fail(format!(
                "invalid {field}: expected {min}-{max}, got {value}"
            ));
        }
        self.set(key, OperationValue::Int(value))
    }

    fn put_range(self, key: &str, value: f64, field: &str, min: f64, max: f64) -> Self {
        if !value.is_finite() || value < min || value > max {
            return self.fail(format!(
                "invalid {field}: expected {min}-{max}, got {value}"
            ));
        }
        self.set(key, OperationValue::Float(value))
    }
}

fn transform_rest(
    client: &Client,
    transport: &RestTransport,
    input: Input,
    ops: &Operations,
) -> Result<Response> {
    let endpoint = rest_endpoint(&client.base_url, &transport.path, ops);
    let opened = input.open(&client.http)?;
    let mut part = match opened.length {
        Some(length) => multipart::Part::reader_with_length(opened.reader, length),
        None => multipart::Part::reader(opened.reader),
    }
    .file_name(opened.filename)
    .mime_str(&opened.content_type)
    .map_err(|err| SharptownError::new(err.to_string()))?;

    // Explicitly opt into streaming readers; reqwest will not pre-read the file into a Vec.
    part = part.headers(reqwest::header::HeaderMap::new());
    let form = multipart::Form::new().part(transport.field.clone(), part);

    let mut request = client.http.post(endpoint).multipart(form);
    for (key, value) in &client.headers {
        request = request.header(header_name(key)?, header_value(key, value)?);
    }

    let response = request
        .send()
        .map_err(|err| SharptownError::new(format!("http request failed: {err}")))?;
    response_from_http(response)
}

fn transform_jsonrpc(
    client: &Client,
    transport: &JsonRpcTransport,
    input: Input,
    ops: &Operations,
) -> Result<Response> {
    let mut opened = input.open(&client.http)?;
    let mut data = Vec::new();
    opened
        .reader
        .read_to_end(&mut data)
        .map_err(|err| SharptownError::new(format!("reading input: {err}")))?;

    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": transport.method,
        "params": {
            "image": BASE64_STANDARD.encode(data),
            "options": operation_json(ops),
        },
    });
    let message =
        serde_json::to_string(&payload).map_err(|err| SharptownError::new(err.to_string()))?;

    let endpoint = ws_endpoint(&client.base_url, &transport.path);
    let mut request = endpoint
        .into_client_request()
        .map_err(|err| SharptownError::new(err.to_string()))?;
    for (key, value) in &client.headers {
        request
            .headers_mut()
            .insert(header_name(key)?, header_value(key, value)?);
    }

    let (mut socket, _) =
        connect(request).map_err(|err| SharptownError::new(format!("websocket dial: {err}")))?;
    socket
        .send(Message::Text(message.into()))
        .map_err(|err| SharptownError::new(format!("websocket write: {err}")))?;
    let reply = socket
        .read()
        .map_err(|err| SharptownError::new(format!("websocket read: {err}")))?;

    match reply {
        Message::Text(text) => decode_rpc(text.as_bytes()),
        Message::Binary(bytes) => decode_rpc(&bytes),
        _ => Err(SharptownError::new("unexpected JSON-RPC websocket message")),
    }
}

#[derive(Debug, Deserialize)]
struct RpcEnvelope {
    error: Option<RpcErrorPayload>,
    result: Option<RpcResultPayload>,
}

#[derive(Debug, Deserialize)]
struct RpcErrorPayload {
    code: i32,
    message: String,
    #[serde(default)]
    data: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
struct RpcResultPayload {
    image: String,
    #[serde(rename = "contentType")]
    content_type: Option<String>,
}

fn decode_rpc(message: &[u8]) -> Result<Response> {
    let envelope: RpcEnvelope = serde_json::from_slice(message)
        .map_err(|_| SharptownError::new("malformed JSON-RPC response"))?;
    if let Some(error) = envelope.error {
        return Err(SharptownError::with_status(
            error.message,
            error.code,
            error.data,
        ));
    }
    let result = envelope
        .result
        .ok_or_else(|| SharptownError::new("JSON-RPC response is missing result"))?;
    let body = BASE64_STANDARD
        .decode(result.image)
        .map_err(|_| SharptownError::new("JSON-RPC result.image is not valid base64"))?;
    let content_type = result
        .content_type
        .unwrap_or_else(|| "application/octet-stream".to_string());
    Ok(Response {
        status: 200,
        headers: vec![("content-type".to_string(), content_type)],
        body,
    })
}

fn response_from_http(response: reqwest::blocking::Response) -> Result<Response> {
    let status = response.status();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect::<Vec<_>>();
    let body = response.bytes()?.to_vec();

    if !status.is_success() {
        let parsed = serde_json::from_slice::<JsonValue>(&body).ok();
        let message = parsed
            .as_ref()
            .and_then(|body| body.get("error"))
            .and_then(|error| error.as_str())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| format!("sharptown request failed with status {}", status.as_u16()));
        return Err(SharptownError::with_status(
            message,
            i32::from(status.as_u16()),
            parsed,
        ));
    }

    Ok(Response {
        status: status.as_u16(),
        headers,
        body,
    })
}

pub fn operation_json(ops: &Operations) -> serde_json::Map<String, JsonValue> {
    let mut out = serde_json::Map::new();
    for key in OPERATION_ORDER {
        if let Some(value) = ops.get(*key) {
            out.insert((*key).to_string(), value.json_value());
        }
    }
    out
}

pub fn query_string(ops: &Operations) -> String {
    let mut serializer = Serializer::new(String::new());
    for key in OPERATION_ORDER {
        if let Some(value) = ops.get(*key) {
            serializer.append_pair(key, &value.query_value());
        }
    }
    serializer.finish()
}

fn rest_endpoint(base_url: &str, path: &str, ops: &Operations) -> String {
    let mut endpoint = http_base(base_url);
    endpoint.push_str(path);
    let query = query_string(ops);
    if !query.is_empty() {
        endpoint.push('?');
        endpoint.push_str(&query);
    }
    endpoint
}

fn ws_endpoint(base_url: &str, path: &str) -> String {
    let base = ws_base(base_url);
    if url::Url::parse(&base)
        .map(|parsed| parsed.path().is_empty() || parsed.path() == "/")
        .unwrap_or(true)
    {
        format!("{base}{path}")
    } else {
        base
    }
}

pub fn http_base(base: &str) -> String {
    let (secure, authority) = split_scheme(base);
    format!("{}://{}", if secure { "https" } else { "http" }, authority)
}

pub fn ws_base(base: &str) -> String {
    let (secure, authority) = split_scheme(base);
    format!("{}://{}", if secure { "wss" } else { "ws" }, authority)
}

fn split_scheme(base: &str) -> (bool, String) {
    let trimmed = trim_base(base.to_string());
    if let Some(index) = trimmed.find("://") {
        let scheme = trimmed[..index].to_ascii_lowercase();
        let authority = trimmed[index + 3..].to_string();
        return (scheme != "http" && scheme != "ws", authority);
    }
    (true, trimmed)
}

fn trim_base(base: String) -> String {
    base.trim().trim_end_matches('/').to_string()
}

fn filename_from_url(raw: &str) -> Option<String> {
    let parsed = url::Url::parse(raw).ok()?;
    let name = parsed
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .last()?;
    Some(name.to_string())
}

fn or_default(value: String, fallback: &str) -> String {
    if value.is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

fn guess_content_type(filename: &str) -> String {
    match Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "heif" | "heic" => "image/heif",
        "tif" | "tiff" => "image/tiff",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn header_name(key: &str) -> Result<HeaderName> {
    HeaderName::from_bytes(key.as_bytes())
        .map_err(|err| SharptownError::new(format!("invalid header name {key:?}: {err}")))
}

fn header_value(key: &str, value: &str) -> Result<HeaderValue> {
    HeaderValue::from_str(value)
        .map_err(|err| SharptownError::new(format!("invalid header value for {key:?}: {err}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_query_in_canonical_order() {
        let client = Client::new("http://localhost:3001");
        let transform = client
            .transform(Input::bytes([], "photo.jpg"))
            .convert("webp")
            .resize(800, 600)
            .blur(3)
            .grayscale();

        assert_eq!(
            query_string(transform.operations()),
            "width=800&height=600&blur=3&grayscale=true&convertTo=webp"
        );
    }

    #[test]
    fn validates_first_error() {
        let client = Client::new("http://localhost:3001");
        let transform = client
            .transform(Input::bytes([], "photo.jpg"))
            .width(-1)
            .quality(200);

        assert_eq!(
            transform.err().map(|err| err.message.as_str()),
            Some("invalid width: expected a non-negative integer, got -1")
        );
    }

    #[test]
    fn resolves_base_protocol_family() {
        assert_eq!(http_base("localhost:3001"), "https://localhost:3001");
        assert_eq!(http_base("http://localhost:3001/"), "http://localhost:3001");
        assert_eq!(ws_base("http://localhost:3002"), "ws://localhost:3002");
        assert_eq!(ws_base("wss://localhost:3002"), "wss://localhost:3002");
        assert_eq!(
            ws_endpoint("ws://localhost:3002", "/rpc"),
            "ws://localhost:3002/rpc"
        );
    }

    #[test]
    fn operation_json_uses_canonical_names() {
        let client = Client::new("http://localhost:3001");
        let transform = client
            .transform(Input::bytes([], "photo.jpg"))
            .smart_crop()
            .keep_metadata()
            .to_format("png");
        let json = operation_json(transform.operations());

        assert_eq!(json.get("smartCrop"), Some(&JsonValue::Bool(true)));
        assert_eq!(json.get("stripMetadata"), Some(&JsonValue::Bool(false)));
        assert_eq!(
            json.get("convertTo"),
            Some(&JsonValue::String("png".to_string()))
        );
    }

    #[test]
    fn content_type_is_guessed_from_filename() {
        assert_eq!(guess_content_type("photo.jpeg"), "image/jpeg");
        assert_eq!(guess_content_type("photo.heic"), "image/heif");
        assert_eq!(guess_content_type("photo.bin"), "application/octet-stream");
    }

    #[test]
    fn decodes_jsonrpc_response() {
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "image": BASE64_STANDARD.encode([1_u8, 2, 3]),
                "contentType": "image/webp"
            }
        });

        let response = decode_rpc(payload.to_string().as_bytes()).unwrap();

        assert_eq!(response.status, 200);
        assert_eq!(response.content_type(), Some("image/webp"));
        assert_eq!(response.body, vec![1, 2, 3]);
    }
}
