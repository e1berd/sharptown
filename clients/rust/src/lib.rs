use std::collections::{BTreeMap, HashMap};
use std::fmt;
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::prelude::*;
use hmac::{Hmac, Mac};
use reqwest::blocking::{multipart, Client as HttpClient};
use reqwest::header::{HeaderName, HeaderValue};
use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use sha2::Sha256;
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
    "trim",
    "chromaKey",
    "composite",
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
    proxy_secret: Option<String>,
    proxy_path: String,
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
            proxy_secret: None,
            proxy_path: "/api/v1/fetch".to_string(),
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
            marks: Vec::new(),
            err: None,
        }
    }

    /// Sets the shared HMAC secret (the server's `SHARPTOWN_PROXY_KEY`) used by
    /// [`Client::signed_url`]. Sign on a trusted server only; never embed the secret in a
    /// public client.
    pub fn with_proxy_secret(mut self, secret: impl Into<String>) -> Self {
        self.proxy_secret = Some(secret.into());
        self
    }

    /// Overrides the signed image-proxy endpoint path (default `/api/v1/fetch`).
    pub fn with_proxy_path(mut self, path: impl Into<String>) -> Self {
        self.proxy_path = path.into();
        self
    }

    /// Builds a signed image-proxy URL for the server's `GET /fetch` endpoint, suitable for an
    /// `<img>` tag. The server downloads `source`, applies `ops`, and serves a cached result.
    /// The HMAC-SHA256 signature covers the source URL and every operation. Requires
    /// [`Client::with_proxy_secret`].
    ///
    /// ```no_run
    /// # use sharptown::{Client, Operations, OperationValue};
    /// let client = Client::new("https://img.example.com").with_proxy_secret("secret");
    /// let mut ops = Operations::new();
    /// ops.insert("width".into(), OperationValue::Int(800));
    /// let url = client.signed_url("https://example.com/photo.jpg", &ops).unwrap();
    /// ```
    pub fn signed_url(&self, source: impl Into<String>, ops: &Operations) -> Result<String> {
        let source = source.into();
        if source.is_empty() {
            return Err(SharptownError::new("signed_url: source is required"));
        }
        let secret = self
            .proxy_secret
            .as_deref()
            .ok_or_else(|| SharptownError::new("signed_url requires with_proxy_secret"))?;

        let mut params: BTreeMap<String, String> = BTreeMap::new();
        for key in OPERATION_ORDER {
            if let Some(value) = ops.get(*key) {
                params.insert((*key).to_string(), value.query_value());
            }
        }
        params.insert("url".to_string(), source);

        let canonical = params
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("&");

        let mut mac =
            Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
        mac.update(canonical.as_bytes());
        let signature = BASE64_URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());

        let mut serializer = Serializer::new(String::new());
        for (key, value) in &params {
            serializer.append_pair(key, value);
        }
        serializer.append_pair("sig", &signature);

        Ok(format!(
            "{}{}?{}",
            http_base(&self.base_url),
            self.proxy_path,
            serializer.finish()
        ))
    }
}

pub struct Transform<'a> {
    client: &'a Client,
    input: Input,
    ops: Operations,
    marks: Vec<(JsonValue, Option<Vec<u8>>)>,
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

    /// Trims uniform edges at the default threshold.
    pub fn trim(self) -> Self {
        self.set("trim", OperationValue::Bool(true))
    }

    /// Trims uniform edges at a 1–255 threshold (higher trims more aggressively).
    pub fn trim_threshold(self, threshold: i64) -> Self {
        if !(1..=255).contains(&threshold) {
            return self.fail(format!("invalid trim: expected 1-255, got {threshold}"));
        }
        self.set("trim", OperationValue::Int(threshold))
    }

    /// Makes a colour transparent (chroma key). The colour is `#rrggbb`, `r,g,b` or a name.
    /// Applied on the REST server.
    pub fn chroma_key(self, color: impl Into<String>) -> Self {
        self.set("chromaKey", OperationValue::String(color.into()))
    }

    /// Like [`Transform::chroma_key`] with a tolerance percentage (0–100, default 12).
    pub fn chroma_key_tolerance(self, color: impl Into<String>, tolerance: i64) -> Self {
        self.set(
            "chromaKey",
            OperationValue::String(format!("{};{}", color.into(), tolerance)),
        )
    }

    /// Overlays a [`Watermark`] (image) or [`Textmark`] (text) onto the result. Call it more
    /// than once to stack overlays; they are composited in order. Applied on the REST server.
    pub fn composite(mut self, mark: impl CompositeMark) -> Self {
        if self.err.is_none() {
            self.marks.push(mark.into_overlay());
        }
        self
    }

    pub fn response(mut self) -> Result<Response> {
        if let Some(err) = self.err {
            return Err(err);
        }

        let mut attachments: Vec<Vec<u8>> = Vec::new();
        if !self.marks.is_empty() {
            let mut specs: Vec<JsonValue> = Vec::new();
            for (mut spec, bytes) in std::mem::take(&mut self.marks) {
                if let Some(data) = bytes {
                    if let JsonValue::Object(ref mut map) = spec {
                        map.insert("ref".to_string(), JsonValue::from(attachments.len()));
                    }
                    attachments.push(data);
                }
                specs.push(spec);
            }
            let encoded = serde_json::to_string(&specs)
                .map_err(|err| SharptownError::new(err.to_string()))?;
            self.ops.insert("composite".to_string(), OperationValue::String(encoded));
        }

        match &self.client.transport {
            Transport::Rest(transport) => {
                transform_rest(self.client, transport, self.input, &self.ops, &attachments)
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

/// An overlay passed to [`Transform::composite`] — a [`Watermark`] (image) or a
/// [`Textmark`] (text).
pub trait CompositeMark {
    /// Resolves the overlay into its wire spec, plus optional bytes to upload.
    fn into_overlay(self) -> (JsonValue, Option<Vec<u8>>);
}

/// An image overlay composited onto the result. Build it from a URL the server fetches
/// ([`Watermark::url`]) or from image bytes uploaded with the request ([`Watermark::bytes`]),
/// then chain the placement and appearance methods.
pub struct Watermark {
    spec: serde_json::Map<String, JsonValue>,
    bytes: Option<Vec<u8>>,
}

impl Watermark {
    /// An image watermark fetched from `url` by the server.
    pub fn url(url: impl Into<String>) -> Self {
        let mut spec = serde_json::Map::new();
        spec.insert("type".to_string(), JsonValue::from("image"));
        spec.insert("url".to_string(), JsonValue::from(url.into()));
        Self { spec, bytes: None }
    }

    /// An image watermark uploaded from raw bytes.
    pub fn bytes(data: impl Into<Vec<u8>>) -> Self {
        let mut spec = serde_json::Map::new();
        spec.insert("type".to_string(), JsonValue::from("image"));
        Self { spec, bytes: Some(data.into()) }
    }

    /// Fits the overlay inside `width`×`height`. A non-positive dimension is left unset.
    pub fn resize(mut self, width: i64, height: i64) -> Self {
        if width > 0 {
            self.spec.insert("width".to_string(), JsonValue::from(width));
        }
        if height > 0 {
            self.spec.insert("height".to_string(), JsonValue::from(height));
        }
        self
    }

    /// Sets the overlay width only.
    pub fn width(mut self, value: i64) -> Self {
        self.spec.insert("width".to_string(), JsonValue::from(value));
        self
    }

    /// Sets the overlay height only.
    pub fn height(mut self, value: i64) -> Self {
        self.spec.insert("height".to_string(), JsonValue::from(value));
        self
    }

    /// Rotates the overlay by degrees.
    pub fn rotate(mut self, degrees: i64) -> Self {
        self.spec.insert("rotate".to_string(), JsonValue::from(degrees));
        self
    }

    /// Sets the overlay opacity (0–1).
    pub fn opacity(mut self, value: f64) -> Self {
        self.spec.insert("opacity".to_string(), JsonValue::from(value));
        self
    }

    /// Sets the placement gravity (default `southeast`).
    pub fn gravity(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("gravity".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Places the overlay at `(x, y)` from the top-left instead of a gravity.
    pub fn offset(mut self, x: i64, y: i64) -> Self {
        self.spec.insert("x".to_string(), JsonValue::from(x));
        self.spec.insert("y".to_string(), JsonValue::from(y));
        self
    }

    /// Repeats the overlay across the whole image.
    pub fn tile(mut self) -> Self {
        self.spec.insert("tile".to_string(), JsonValue::from(true));
        self
    }

    /// Sets the Sharp blend mode (default `over`).
    pub fn blend(mut self, mode: impl Into<String>) -> Self {
        self.spec.insert("blend".to_string(), JsonValue::from(mode.into()));
        self
    }
}

impl CompositeMark for Watermark {
    fn into_overlay(self) -> (JsonValue, Option<Vec<u8>>) {
        (JsonValue::Object(self.spec), self.bytes)
    }
}

/// A text overlay composited onto the result, rendered server-side. Pass it to
/// [`Transform::composite`].
pub struct Textmark {
    spec: serde_json::Map<String, JsonValue>,
}

impl Textmark {
    /// Creates a text watermark.
    pub fn new(text: impl Into<String>) -> Self {
        let mut spec = serde_json::Map::new();
        spec.insert("type".to_string(), JsonValue::from("text"));
        spec.insert("text".to_string(), JsonValue::from(text.into()));
        Self { spec }
    }

    /// Font size in pixels.
    pub fn size(mut self, value: i64) -> Self {
        self.spec.insert("size".to_string(), JsonValue::from(value));
        self
    }

    /// Text colour (any CSS colour).
    pub fn color(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("color".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Font family.
    pub fn font(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("font".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Font weight (e.g. `bold`).
    pub fn weight(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("weight".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Background colour painted behind the text tile.
    pub fn background(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("background".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Rotates the text by degrees.
    pub fn rotate(mut self, degrees: i64) -> Self {
        self.spec.insert("rotate".to_string(), JsonValue::from(degrees));
        self
    }

    /// Text opacity (0–1).
    pub fn opacity(mut self, value: f64) -> Self {
        self.spec.insert("opacity".to_string(), JsonValue::from(value));
        self
    }

    /// Placement gravity.
    pub fn gravity(mut self, value: impl Into<String>) -> Self {
        self.spec.insert("gravity".to_string(), JsonValue::from(value.into()));
        self
    }

    /// Places the text at `(x, y)` from the top-left.
    pub fn offset(mut self, x: i64, y: i64) -> Self {
        self.spec.insert("x".to_string(), JsonValue::from(x));
        self.spec.insert("y".to_string(), JsonValue::from(y));
        self
    }

    /// Repeats the text across the whole image.
    pub fn tile(mut self) -> Self {
        self.spec.insert("tile".to_string(), JsonValue::from(true));
        self
    }
}

impl CompositeMark for Textmark {
    fn into_overlay(self) -> (JsonValue, Option<Vec<u8>>) {
        (JsonValue::Object(self.spec), None)
    }
}

fn transform_rest(
    client: &Client,
    transport: &RestTransport,
    input: Input,
    ops: &Operations,
    attachments: &[Vec<u8>],
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
    let mut form = multipart::Form::new().part(transport.field.clone(), part);
    for (index, data) in attachments.iter().enumerate() {
        let overlay = multipart::Part::bytes(data.clone()).file_name(format!("watermark-{index}"));
        form = form.part("watermark", overlay);
    }

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
    fn signed_url_matches_reference_vector() {
        let client = Client::new("https://img.example.com").with_proxy_secret("shared-secret");
        let mut ops = Operations::new();
        ops.insert("width".into(), OperationValue::Int(800));
        ops.insert("blur".into(), OperationValue::Int(3));
        ops.insert("convertTo".into(), OperationValue::String("webp".into()));

        let url = client
            .signed_url("https://example.com/a.jpg?v=2&x=1", &ops)
            .unwrap();
        let sig = url::Url::parse(&url)
            .unwrap()
            .query_pairs()
            .find(|(key, _)| key == "sig")
            .map(|(_, value)| value.into_owned())
            .unwrap();

        assert_eq!(sig, "dxkY7R4OWb1R8p6QnS5C7w6QRn30mUgOFEteIGiuYiI");
    }

    #[test]
    fn composite_marks_and_effects_serialize() {
        let (image, image_bytes) = Watermark::url("https://cdn/logo.png")
            .resize(120, 0)
            .opacity(0.6)
            .gravity("southeast")
            .into_overlay();
        assert!(image_bytes.is_none());
        assert_eq!(image["type"], "image");
        assert_eq!(image["url"], "https://cdn/logo.png");
        assert_eq!(image["width"], 120);
        assert_eq!(image["opacity"], 0.6);

        let (upload, upload_bytes) = Watermark::bytes(vec![1u8, 2, 3]).tile().into_overlay();
        assert_eq!(upload_bytes, Some(vec![1u8, 2, 3]));
        assert_eq!(upload["tile"], true);

        let (text, text_bytes) = Textmark::new("Hi").size(20).color("white").into_overlay();
        assert!(text_bytes.is_none());
        assert_eq!(text["type"], "text");
        assert_eq!(text["text"], "Hi");

        let client = Client::new("http://localhost:3001");
        let t = client
            .transform(Input::bytes(vec![1u8], "in.png"))
            .trim()
            .chroma_key_tolerance("#00ff00", 30);
        assert_eq!(t.operations().get("trim").map(|v| v.query_value()), Some("true".to_string()));
        assert_eq!(
            t.operations().get("chromaKey").map(|v| v.query_value()),
            Some("#00ff00;30".to_string())
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
