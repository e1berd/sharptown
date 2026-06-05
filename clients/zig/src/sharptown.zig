const std = @import("std");

pub const max_response_bytes = 256 * 1024 * 1024;
pub const max_jsonrpc_input_bytes = 256 * 1024 * 1024;

const operation_order = [_][]const u8{
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
};

const supported_formats = [_][]const u8{ "webp", "png", "jpg", "jpeg", "avif", "gif", "heif" };
const fit_modes = [_][]const u8{ "cover", "contain", "fill", "inside", "outside" };

pub const Error = error{
    InvalidOperation,
    InvalidUrl,
    HttpRequestFailed,
    OutOfMemory,
} || std.fs.File.OpenError || std.fs.File.ReadError || std.fs.File.WriteError || std.Uri.ParseError;

pub const Header = struct {
    name: []const u8,
    value: []const u8,
};

pub const RestTransport = struct {
    path: []const u8 = "/api/v1/transform",
    field: []const u8 = "image",
};

pub const JsonRpcTransport = struct {
    path: []const u8 = "/rpc",
    method: []const u8 = "image.transform",
};

pub const Transport = union(enum) {
    rest: RestTransport,
    jsonrpc: JsonRpcTransport,
};

pub const Client = struct {
    allocator: std.mem.Allocator,
    base_url: []const u8,
    headers: []const Header = &.{},
    transport: Transport = .{ .rest = .{} },

    pub fn init(allocator: std.mem.Allocator, base_url: []const u8) Client {
        return .{
            .allocator = allocator,
            .base_url = trimBase(base_url),
        };
    }

    pub fn withHeaders(self: Client, headers: []const Header) Client {
        var copy = self;
        copy.headers = headers;
        return copy;
    }

    pub fn withRestTransport(self: Client, transport: RestTransport) Client {
        var copy = self;
        copy.transport = .{ .rest = transport };
        return copy;
    }

    pub fn withJsonRpcTransport(self: Client, transport: JsonRpcTransport) Client {
        var copy = self;
        copy.transport = .{ .jsonrpc = transport };
        return copy;
    }

    pub fn transform(self: *const Client, input: Input) Transform {
        return .{
            .client = self,
            .input = input,
        };
    }
};

pub const Input = union(enum) {
    bytes: ByteInput,
    path: []const u8,
    url: UrlInput,

    pub fn fromBytes(data: []const u8, filename: []const u8) Input {
        return .{ .bytes = .{ .data = data, .filename = if (filename.len == 0) "image" else filename } };
    }

    pub fn fromPath(path: []const u8) Input {
        return .{ .path = path };
    }

    pub fn fromUrl(url: []const u8, filename: ?[]const u8) Input {
        return .{ .url = .{ .url = url, .filename = filename } };
    }

    fn load(self: Input, allocator: std.mem.Allocator) !LoadedInput {
        switch (self) {
            .bytes => |input| return .{
                .data = input.data,
                .filename = input.filename,
                .content_type = guessContentType(input.filename),
                .owns_data = false,
            },
            .path => |path| {
                const data = try std.fs.cwd().readFileAlloc(allocator, path, max_response_bytes);
                const filename = std.fs.path.basename(path);
                return .{
                    .data = data,
                    .filename = if (filename.len == 0) "image" else filename,
                    .content_type = guessContentType(filename),
                    .owns_data = true,
                };
            },
            .url => |input| {
                const data = try fetchUrl(allocator, input.url);
                const filename = input.filename orelse filenameFromUrl(input.url) orelse "image";
                return .{
                    .data = data,
                    .filename = filename,
                    .content_type = guessContentType(filename),
                    .owns_data = true,
                };
            },
        }
    }
};

pub const ByteInput = struct {
    data: []const u8,
    filename: []const u8,
};

pub const UrlInput = struct {
    url: []const u8,
    filename: ?[]const u8 = null,
};

const LoadedInput = struct {
    data: []const u8,
    filename: []const u8,
    content_type: []const u8,
    owns_data: bool,

    fn deinit(self: LoadedInput, allocator: std.mem.Allocator) void {
        if (self.owns_data) allocator.free(self.data);
    }
};

pub const Response = struct {
    status: u16,
    content_type: ?[]const u8 = null,
    body: []u8,
    allocator: std.mem.Allocator,

    pub fn deinit(self: Response) void {
        self.allocator.free(self.body);
    }

    pub fn save(self: Response, path: []const u8) !void {
        try std.fs.cwd().writeFile(.{ .sub_path = path, .data = self.body });
    }
};

pub const Operations = struct {
    width: ?i64 = null,
    height: ?i64 = null,
    dpr: ?f64 = null,
    aspectRatio: ?f64 = null,
    fit: ?[]const u8 = null,
    background: ?[]const u8 = null,
    smartCrop: ?bool = null,
    crop: ?[]const u8 = null,
    cropOffset: ?[]const u8 = null,
    autoOrient: ?bool = null,
    rotate: ?i64 = null,
    flip: ?bool = null,
    blur: ?i64 = null,
    sharpen: ?f64 = null,
    oilPaint: ?i64 = null,
    brightness: ?f64 = null,
    contrast: ?f64 = null,
    saturation: ?f64 = null,
    exposure: ?f64 = null,
    hue: ?f64 = null,
    gamma: ?f64 = null,
    colorize: ?[]const u8 = null,
    sepia: ?f64 = null,
    invert: ?bool = null,
    threshold: ?i64 = null,
    r: ?i64 = null,
    g: ?i64 = null,
    b: ?i64 = null,
    grayscale: ?bool = null,
    removeAlpha: ?bool = null,
    ensureAlpha: ?bool = null,
    convertTo: ?[]const u8 = null,
    quality: ?i64 = null,
    progressive: ?bool = null,
    stripMetadata: ?bool = null,
};

pub const Transform = struct {
    client: *const Client,
    input: Input,
    operations: Operations = .{},

    pub fn resize(self: *Transform, width_value: i64, height_value: i64) !*Transform {
        _ = try self.width(width_value);
        _ = try self.height(height_value);
        return self;
    }

    pub fn width(self: *Transform, value: i64) !*Transform {
        try nonNegative("width", value);
        self.operations.width = value;
        return self;
    }

    pub fn height(self: *Transform, value: i64) !*Transform {
        try nonNegative("height", value);
        self.operations.height = value;
        return self;
    }

    pub fn crop(self: *Transform, left: i64, top: i64, width_value: i64, height_value: i64) !*Transform {
        try nonNegative("crop.left", left);
        try nonNegative("crop.top", top);
        try nonNegative("crop.width", width_value);
        try nonNegative("crop.height", height_value);
        self.operations.crop = try std.fmt.allocPrint(
            self.client.allocator,
            "{d},{d},{d},{d}",
            .{ left, top, width_value, height_value },
        );
        return self;
    }

    pub fn smartCrop(self: *Transform) *Transform {
        self.operations.smartCrop = true;
        return self;
    }

    pub fn fit(self: *Transform, mode: []const u8) !*Transform {
        const lowered = try lowerAlloc(self.client.allocator, mode);
        if (!contains(&fit_modes, lowered)) return Error.InvalidOperation;
        self.operations.fit = lowered;
        return self;
    }

    pub fn background(self: *Transform, color: []const u8) *Transform {
        self.operations.background = color;
        return self;
    }

    pub fn dpr(self: *Transform, value: f64) !*Transform {
        try inRange("dpr", value, 0.1, 5);
        self.operations.dpr = value;
        return self;
    }

    pub fn aspectRatio(self: *Transform, value: f64) !*Transform {
        try inRange("aspectRatio", value, 0.0001, 1000);
        self.operations.aspectRatio = value;
        return self;
    }

    pub fn autoOrient(self: *Transform) *Transform {
        self.operations.autoOrient = true;
        return self;
    }

    pub fn rotate(self: *Transform, degrees: i64) *Transform {
        self.operations.rotate = degrees;
        return self;
    }

    pub fn flip(self: *Transform) *Transform {
        self.operations.flip = true;
        return self;
    }

    pub fn blur(self: *Transform, sigma: i64) !*Transform {
        try nonNegative("blur", sigma);
        self.operations.blur = sigma;
        return self;
    }

    pub fn tint(self: *Transform, red: i64, green: i64, blue: i64) !*Transform {
        try colorChannel("r", red);
        try colorChannel("g", green);
        try colorChannel("b", blue);
        self.operations.r = red;
        self.operations.g = green;
        self.operations.b = blue;
        return self;
    }

    pub fn grayscale(self: *Transform) *Transform {
        self.operations.grayscale = true;
        return self;
    }

    pub fn greyscale(self: *Transform) *Transform {
        return self.grayscale();
    }

    pub fn removeAlpha(self: *Transform) *Transform {
        self.operations.removeAlpha = true;
        return self;
    }

    pub fn ensureAlpha(self: *Transform) *Transform {
        self.operations.ensureAlpha = true;
        return self;
    }

    pub fn brightness(self: *Transform, value: f64) !*Transform {
        try inRange("brightness", value, -100, 100);
        self.operations.brightness = value;
        return self;
    }

    pub fn contrast(self: *Transform, value: f64) !*Transform {
        try inRange("contrast", value, -100, 100);
        self.operations.contrast = value;
        return self;
    }

    pub fn saturation(self: *Transform, value: f64) !*Transform {
        try inRange("saturation", value, 0, 2);
        self.operations.saturation = value;
        return self;
    }

    pub fn exposure(self: *Transform, value: f64) !*Transform {
        try inRange("exposure", value, -3, 3);
        self.operations.exposure = value;
        return self;
    }

    pub fn hue(self: *Transform, value: f64) !*Transform {
        try inRange("hue", value, 0, 360);
        self.operations.hue = value;
        return self;
    }

    pub fn gamma(self: *Transform, value: f64) !*Transform {
        try inRange("gamma", value, 1, 3);
        self.operations.gamma = value;
        return self;
    }

    pub fn colorize(self: *Transform, color: []const u8) *Transform {
        self.operations.colorize = color;
        return self;
    }

    pub fn sepia(self: *Transform, intensity: f64) !*Transform {
        try inRange("sepia", intensity, 0, 1);
        self.operations.sepia = intensity;
        return self;
    }

    pub fn invert(self: *Transform) *Transform {
        self.operations.invert = true;
        return self;
    }

    pub fn threshold(self: *Transform, value: i64) !*Transform {
        try intRange("threshold", value, 0, 255);
        self.operations.threshold = value;
        return self;
    }

    pub fn sharpen(self: *Transform, sigma: f64) !*Transform {
        try inRange("sharpen", sigma, 0, 5);
        self.operations.sharpen = sigma;
        return self;
    }

    pub fn oilPaint(self: *Transform, size: i64) !*Transform {
        try intRange("oilPaint", size, 1, 25);
        self.operations.oilPaint = size;
        return self;
    }

    pub fn quality(self: *Transform, value: i64) !*Transform {
        try intRange("quality", value, 1, 100);
        self.operations.quality = value;
        return self;
    }

    pub fn progressive(self: *Transform) *Transform {
        self.operations.progressive = true;
        return self;
    }

    pub fn stripMetadata(self: *Transform) *Transform {
        self.operations.stripMetadata = true;
        return self;
    }

    pub fn keepMetadata(self: *Transform) *Transform {
        self.operations.stripMetadata = false;
        return self;
    }

    pub fn convert(self: *Transform, format: []const u8) !*Transform {
        const lowered = try lowerAlloc(self.client.allocator, format);
        if (!contains(&supported_formats, lowered)) return Error.InvalidOperation;
        self.operations.convertTo = lowered;
        return self;
    }

    pub fn toFormat(self: *Transform, format: []const u8) !*Transform {
        return self.convert(format);
    }

    pub fn response(self: Transform) !Response {
        return switch (self.client.transport) {
            .rest => |transport| transformRest(self.client, transport, self.input, self.operations),
            .jsonrpc => |transport| transformJsonRpc(self.client, transport, self.input, self.operations),
        };
    }

    pub fn bytes(self: Transform) ![]u8 {
        return (try self.response()).body;
    }

    pub fn save(self: Transform, path: []const u8) !void {
        const res = try self.response();
        defer res.deinit();
        try res.save(path);
    }
};

fn transformRest(client: *const Client, transport: RestTransport, input: Input, operations: Operations) !Response {
    const allocator = client.allocator;
    const endpoint = try restEndpoint(allocator, client.base_url, transport.path, operations);
    defer allocator.free(endpoint);

    const boundary = "sharptown-zig-boundary";
    const multipart_info = try multipartInfo(allocator, boundary, transport.field, input);
    defer multipart_info.deinit(allocator);

    var http_client = std.http.Client{ .allocator = allocator };
    defer http_client.deinit();

    const uri = try std.Uri.parse(endpoint);
    const content_type = try std.fmt.allocPrint(allocator, "multipart/form-data; boundary={s}", .{boundary});
    defer allocator.free(content_type);

    var header_storage = try allocator.alloc(std.http.Header, client.headers.len + 1);
    defer allocator.free(header_storage);
    header_storage[0] = .{ .name = "content-type", .value = content_type };
    for (client.headers, 0..) |header, index| {
        header_storage[index + 1] = .{ .name = header.name, .value = header.value };
    }

    var server_header_buffer: [16 * 1024]u8 = undefined;
    var req = try http_client.open(.POST, uri, .{
        .server_header_buffer = &server_header_buffer,
        .extra_headers = header_storage,
    });
    defer req.deinit();

    req.transfer_encoding = .{ .content_length = multipart_info.content_length };
    try req.send();
    try writeMultipart(&req, multipart_info, input, allocator);
    try req.finish();
    try req.wait();

    const response_body = try req.reader().readAllAlloc(allocator, max_response_bytes);
    const status: u16 = @intCast(@intFromEnum(req.response.status));
    if (status < 200 or status >= 300) return Error.HttpRequestFailed;

    return .{
        .status = status,
        .content_type = null,
        .body = response_body,
        .allocator = allocator,
    };
}

fn transformJsonRpc(client: *const Client, transport: JsonRpcTransport, input: Input, operations: Operations) !Response {
    const allocator = client.allocator;
    const endpoint = try wsEndpoint(allocator, client.base_url, transport.path);
    defer allocator.free(endpoint);

    const loaded = try input.load(allocator);
    defer loaded.deinit(allocator);

    const encoded_len = std.base64.standard.Encoder.calcSize(loaded.data.len);
    const encoded = try allocator.alloc(u8, encoded_len);
    defer allocator.free(encoded);
    _ = std.base64.standard.Encoder.encode(encoded, loaded.data);

    const options = try operationJson(allocator, operations);
    defer allocator.free(options);

    var message = std.ArrayList(u8).init(allocator);
    defer message.deinit();
    try message.appendSlice("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":");
    try std.json.stringify(transport.method, .{}, message.writer());
    try message.appendSlice(",\"params\":{\"image\":");
    try std.json.stringify(encoded, .{}, message.writer());
    try message.appendSlice(",\"options\":");
    try message.appendSlice(options);
    try message.appendSlice("}}");

    const reply = try websocketRequest(allocator, endpoint, client.headers, message.items);
    defer allocator.free(reply);

    return decodeRpcResponse(allocator, reply);
}

fn fetchUrl(allocator: std.mem.Allocator, raw_url: []const u8) ![]u8 {
    var http_client = std.http.Client{ .allocator = allocator };
    defer http_client.deinit();

    const uri = try std.Uri.parse(raw_url);
    var server_header_buffer: [16 * 1024]u8 = undefined;
    var req = try http_client.open(.GET, uri, .{ .server_header_buffer = &server_header_buffer });
    defer req.deinit();

    try req.send();
    try req.finish();
    try req.wait();

    const status: u16 = @intCast(@intFromEnum(req.response.status));
    if (status < 200 or status >= 300) return Error.HttpRequestFailed;

    return req.reader().readAllAlloc(allocator, max_jsonrpc_input_bytes);
}

pub fn restEndpoint(allocator: std.mem.Allocator, base_url: []const u8, path: []const u8, operations: Operations) ![]u8 {
    const base = try httpBase(allocator, base_url);
    defer allocator.free(base);

    const query = try queryString(allocator, operations);
    defer allocator.free(query);

    if (query.len == 0) {
        return std.fmt.allocPrint(allocator, "{s}{s}", .{ base, path });
    }
    return std.fmt.allocPrint(allocator, "{s}{s}?{s}", .{ base, path, query });
}

pub fn queryString(allocator: std.mem.Allocator, operations: Operations) ![]u8 {
    var out = std.ArrayList(u8).init(allocator);
    errdefer out.deinit();

    inline for (operation_order) |name| {
        if (try operationValue(allocator, operations, name)) |value| {
            defer allocator.free(value);
            if (out.items.len > 0) try out.append('&');
            try percentEncodeAppend(&out, name);
            try out.append('=');
            try percentEncodeAppend(&out, value);
        }
    }

    return out.toOwnedSlice();
}

fn operationValue(allocator: std.mem.Allocator, ops: Operations, name: []const u8) !?[]u8 {
    if (std.mem.eql(u8, name, "width")) return intValue(allocator, ops.width);
    if (std.mem.eql(u8, name, "height")) return intValue(allocator, ops.height);
    if (std.mem.eql(u8, name, "dpr")) return floatValue(allocator, ops.dpr);
    if (std.mem.eql(u8, name, "aspectRatio")) return floatValue(allocator, ops.aspectRatio);
    if (std.mem.eql(u8, name, "fit")) return stringValue(allocator, ops.fit);
    if (std.mem.eql(u8, name, "background")) return stringValue(allocator, ops.background);
    if (std.mem.eql(u8, name, "smartCrop")) return boolValue(allocator, ops.smartCrop);
    if (std.mem.eql(u8, name, "crop")) return stringValue(allocator, ops.crop);
    if (std.mem.eql(u8, name, "cropOffset")) return stringValue(allocator, ops.cropOffset);
    if (std.mem.eql(u8, name, "autoOrient")) return boolValue(allocator, ops.autoOrient);
    if (std.mem.eql(u8, name, "rotate")) return intValue(allocator, ops.rotate);
    if (std.mem.eql(u8, name, "flip")) return boolValue(allocator, ops.flip);
    if (std.mem.eql(u8, name, "blur")) return intValue(allocator, ops.blur);
    if (std.mem.eql(u8, name, "sharpen")) return floatValue(allocator, ops.sharpen);
    if (std.mem.eql(u8, name, "oilPaint")) return intValue(allocator, ops.oilPaint);
    if (std.mem.eql(u8, name, "brightness")) return floatValue(allocator, ops.brightness);
    if (std.mem.eql(u8, name, "contrast")) return floatValue(allocator, ops.contrast);
    if (std.mem.eql(u8, name, "saturation")) return floatValue(allocator, ops.saturation);
    if (std.mem.eql(u8, name, "exposure")) return floatValue(allocator, ops.exposure);
    if (std.mem.eql(u8, name, "hue")) return floatValue(allocator, ops.hue);
    if (std.mem.eql(u8, name, "gamma")) return floatValue(allocator, ops.gamma);
    if (std.mem.eql(u8, name, "colorize")) return stringValue(allocator, ops.colorize);
    if (std.mem.eql(u8, name, "sepia")) return floatValue(allocator, ops.sepia);
    if (std.mem.eql(u8, name, "invert")) return boolValue(allocator, ops.invert);
    if (std.mem.eql(u8, name, "threshold")) return intValue(allocator, ops.threshold);
    if (std.mem.eql(u8, name, "r")) return intValue(allocator, ops.r);
    if (std.mem.eql(u8, name, "g")) return intValue(allocator, ops.g);
    if (std.mem.eql(u8, name, "b")) return intValue(allocator, ops.b);
    if (std.mem.eql(u8, name, "grayscale")) return boolValue(allocator, ops.grayscale);
    if (std.mem.eql(u8, name, "removeAlpha")) return boolValue(allocator, ops.removeAlpha);
    if (std.mem.eql(u8, name, "ensureAlpha")) return boolValue(allocator, ops.ensureAlpha);
    if (std.mem.eql(u8, name, "convertTo")) return stringValue(allocator, ops.convertTo);
    if (std.mem.eql(u8, name, "quality")) return intValue(allocator, ops.quality);
    if (std.mem.eql(u8, name, "progressive")) return boolValue(allocator, ops.progressive);
    if (std.mem.eql(u8, name, "stripMetadata")) return boolValue(allocator, ops.stripMetadata);
    return null;
}

fn intValue(allocator: std.mem.Allocator, value: ?i64) !?[]u8 {
    if (value) |actual| return std.fmt.allocPrint(allocator, "{d}", .{actual});
    return null;
}

fn floatValue(allocator: std.mem.Allocator, value: ?f64) !?[]u8 {
    if (value) |actual| return std.fmt.allocPrint(allocator, "{d}", .{actual});
    return null;
}

fn boolValue(allocator: std.mem.Allocator, value: ?bool) !?[]u8 {
    if (value) |actual| return allocator.dupe(u8, if (actual) "true" else "false");
    return null;
}

fn stringValue(allocator: std.mem.Allocator, value: ?[]const u8) !?[]u8 {
    if (value) |actual| return allocator.dupe(u8, actual);
    return null;
}

const MultipartInfo = struct {
    preamble: []u8,
    footer: []u8,
    content_length: u64,

    fn deinit(self: MultipartInfo, allocator: std.mem.Allocator) void {
        allocator.free(self.preamble);
        allocator.free(self.footer);
    }
};

fn multipartInfo(
    allocator: std.mem.Allocator,
    boundary: []const u8,
    field: []const u8,
    input: Input,
) !MultipartInfo {
    const filename = inputFilename(input);
    const content_type = guessContentType(filename);
    const data_length = try inputLength(input);
    const preamble = try std.fmt.allocPrint(
        allocator,
        "--{s}\r\nContent-Disposition: form-data; name=\"{s}\"; filename=\"{s}\"\r\nContent-Type: {s}\r\n\r\n",
        .{ boundary, field, filename, content_type },
    );
    errdefer allocator.free(preamble);
    const footer = try std.fmt.allocPrint(allocator, "\r\n--{s}--\r\n", .{boundary});

    return .{
        .preamble = preamble,
        .footer = footer,
        .content_length = preamble.len + data_length + footer.len,
    };
}

fn writeMultipart(req: anytype, info: MultipartInfo, input: Input, allocator: std.mem.Allocator) !void {
    try req.writeAll(info.preamble);
    switch (input) {
        .bytes => |bytes| try req.writeAll(bytes.data),
        .path => |path| {
            var file = try std.fs.cwd().openFile(path, .{});
            defer file.close();
            var buffer: [64 * 1024]u8 = undefined;
            while (true) {
                const n = try file.read(&buffer);
                if (n == 0) break;
                try req.writeAll(buffer[0..n]);
            }
        },
        .url => |url| {
            const data = try fetchUrl(allocator, url.url);
            defer allocator.free(data);
            try req.writeAll(data);
        },
    }
    try req.writeAll(info.footer);
}

pub fn httpBase(allocator: std.mem.Allocator, base: []const u8) ![]u8 {
    const parts = splitScheme(base);
    const secure = parts[0];
    const authority = parts[1];
    return std.fmt.allocPrint(allocator, "{s}://{s}", .{ if (secure) "https" else "http", authority });
}

pub fn wsBase(allocator: std.mem.Allocator, base: []const u8) ![]u8 {
    const parts = splitScheme(base);
    const secure = parts[0];
    const authority = parts[1];
    return std.fmt.allocPrint(allocator, "{s}://{s}", .{ if (secure) "wss" else "ws", authority });
}

fn splitScheme(base: []const u8) struct { bool, []const u8 } {
    const trimmed = trimBase(base);
    if (std.mem.indexOf(u8, trimmed, "://")) |index| {
        const scheme = trimmed[0..index];
        const authority = trimmed[index + 3 ..];
        const secure = !(std.ascii.eqlIgnoreCase(scheme, "http") or std.ascii.eqlIgnoreCase(scheme, "ws"));
        return .{ secure, authority };
    }
    return .{ true, trimmed };
}

fn trimBase(base: []const u8) []const u8 {
    return std.mem.trimRight(u8, std.mem.trim(u8, base, " \t\r\n"), "/");
}

fn filenameFromUrl(raw_url: []const u8) ?[]const u8 {
    const question = std.mem.indexOfScalar(u8, raw_url, '?') orelse raw_url.len;
    const path = raw_url[0..question];
    const slash = std.mem.lastIndexOfScalar(u8, path, '/') orelse return null;
    const name = path[slash + 1 ..];
    if (name.len == 0) return null;
    return name;
}

fn inputFilename(input: Input) []const u8 {
    return switch (input) {
        .bytes => |bytes| if (bytes.filename.len == 0) "image" else bytes.filename,
        .path => |path| blk: {
            const filename = std.fs.path.basename(path);
            break :blk if (filename.len == 0) "image" else filename;
        },
        .url => |url| url.filename orelse filenameFromUrl(url.url) orelse "image",
    };
}

fn inputLength(input: Input) !u64 {
    return switch (input) {
        .bytes => |bytes| bytes.data.len,
        .path => |path| (try std.fs.cwd().statFile(path)).size,
        .url => |url| blk: {
            const allocator = std.heap.page_allocator;
            const data = try fetchUrl(allocator, url.url);
            defer allocator.free(data);
            break :blk data.len;
        },
    };
}

fn guessContentType(filename: []const u8) []const u8 {
    const ext = std.fs.path.extension(filename);
    if (std.ascii.eqlIgnoreCase(ext, ".jpg") or std.ascii.eqlIgnoreCase(ext, ".jpeg")) return "image/jpeg";
    if (std.ascii.eqlIgnoreCase(ext, ".png")) return "image/png";
    if (std.ascii.eqlIgnoreCase(ext, ".webp")) return "image/webp";
    if (std.ascii.eqlIgnoreCase(ext, ".gif")) return "image/gif";
    if (std.ascii.eqlIgnoreCase(ext, ".avif")) return "image/avif";
    if (std.ascii.eqlIgnoreCase(ext, ".heif") or std.ascii.eqlIgnoreCase(ext, ".heic")) return "image/heif";
    if (std.ascii.eqlIgnoreCase(ext, ".tif") or std.ascii.eqlIgnoreCase(ext, ".tiff")) return "image/tiff";
    if (std.ascii.eqlIgnoreCase(ext, ".bmp")) return "image/bmp";
    return "application/octet-stream";
}

fn contains(comptime haystack: []const []const u8, needle: []const u8) bool {
    inline for (haystack) |item| {
        if (std.mem.eql(u8, item, needle)) return true;
    }
    return false;
}

fn lowerAlloc(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    const out = try allocator.alloc(u8, value.len);
    for (value, 0..) |char, index| out[index] = std.ascii.toLower(char);
    return out;
}

fn nonNegative(_: []const u8, value: i64) !void {
    if (value < 0) return Error.InvalidOperation;
}

fn intRange(_: []const u8, value: i64, min: i64, max: i64) !void {
    if (value < min or value > max) return Error.InvalidOperation;
}

fn colorChannel(field: []const u8, value: i64) !void {
    try intRange(field, value, 0, 255);
}

fn inRange(_: []const u8, value: f64, min: f64, max: f64) !void {
    if (!std.math.isFinite(value) or value < min or value > max) return Error.InvalidOperation;
}

fn percentEncodeAppend(out: *std.ArrayList(u8), value: []const u8) !void {
    const hex = "0123456789ABCDEF";
    for (value) |byte| {
        const safe = (byte >= 'A' and byte <= 'Z') or
            (byte >= 'a' and byte <= 'z') or
            (byte >= '0' and byte <= '9') or
            byte == '-' or byte == '_' or byte == '.' or byte == '~';
        if (safe) {
            try out.append(byte);
        } else {
            try out.append('%');
            try out.append(hex[byte >> 4]);
            try out.append(hex[byte & 0x0F]);
        }
    }
}

fn wsEndpoint(allocator: std.mem.Allocator, base_url: []const u8, path: []const u8) ![]u8 {
    const base = try wsBase(allocator, base_url);
    defer allocator.free(base);

    const parsed = std.Uri.parse(base) catch return std.fmt.allocPrint(allocator, "{s}{s}", .{ base, path });
    if (parsed.path.percent_encoded.len == 0 or std.mem.eql(u8, parsed.path.percent_encoded, "/")) {
        return std.fmt.allocPrint(allocator, "{s}{s}", .{ base, path });
    }
    return allocator.dupe(u8, base);
}

fn websocketRequest(allocator: std.mem.Allocator, endpoint: []const u8, headers: []const Header, payload: []const u8) ![]u8 {
    const uri = try std.Uri.parse(endpoint);
    if (uri.scheme.len != 2 or !std.ascii.eqlIgnoreCase(uri.scheme, "ws")) {
        return Error.InvalidUrl;
    }

    const host = uri.host orelse return Error.InvalidUrl;
    const port: u16 = uri.port orelse 80;
    var stream = try std.net.tcpConnectToHost(allocator, host.percent_encoded, port);
    defer stream.close();

    const key = "c2hhcnB0b3duLXppZy1jbGllbnQ=";
    const path = if (uri.path.percent_encoded.len == 0) "/" else uri.path.percent_encoded;

    var request = std.ArrayList(u8).init(allocator);
    defer request.deinit();
    try request.writer().print(
        "GET {s} HTTP/1.1\r\nHost: {s}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {s}\r\n",
        .{ path, host.percent_encoded, key },
    );
    for (headers) |header| {
        try request.writer().print("{s}: {s}\r\n", .{ header.name, header.value });
    }
    try request.appendSlice("\r\n");
    try stream.writeAll(request.items);

    var response_buffer: [8192]u8 = undefined;
    const response_len = try stream.read(&response_buffer);
    if (std.mem.indexOf(u8, response_buffer[0..response_len], " 101 ") == null) {
        return Error.HttpRequestFailed;
    }

    try writeWebSocketTextFrame(stream.writer(), payload);
    return readWebSocketFrame(allocator, stream.reader());
}

fn writeWebSocketTextFrame(writer: anytype, payload: []const u8) !void {
    try writer.writeByte(0x81);
    if (payload.len < 126) {
        try writer.writeByte(0x80 | @as(u8, @intCast(payload.len)));
    } else if (payload.len <= std.math.maxInt(u16)) {
        try writer.writeByte(0x80 | 126);
        try writer.writeInt(u16, @intCast(payload.len), .big);
    } else {
        try writer.writeByte(0x80 | 127);
        try writer.writeInt(u64, @intCast(payload.len), .big);
    }

    var mask: [4]u8 = undefined;
    std.crypto.random.bytes(&mask);
    try writer.writeAll(&mask);
    for (payload, 0..) |byte, index| {
        try writer.writeByte(byte ^ mask[index % 4]);
    }
}

fn readWebSocketFrame(allocator: std.mem.Allocator, reader: anytype) ![]u8 {
    const first = try reader.readByte();
    const second = try reader.readByte();
    const opcode = first & 0x0f;
    if (opcode != 0x1 and opcode != 0x2) return Error.HttpRequestFailed;

    var len: u64 = second & 0x7f;
    if (len == 126) {
        len = try reader.readInt(u16, .big);
    } else if (len == 127) {
        len = try reader.readInt(u64, .big);
    }
    if (len > max_response_bytes) return error.OutOfMemory;

    const masked = (second & 0x80) != 0;
    var mask: [4]u8 = undefined;
    if (masked) try reader.readNoEof(&mask);

    const out = try allocator.alloc(u8, @intCast(len));
    errdefer allocator.free(out);
    try reader.readNoEof(out);
    if (masked) {
        for (out, 0..) |*byte, index| byte.* ^= mask[index % 4];
    }
    return out;
}

fn operationJson(allocator: std.mem.Allocator, operations: Operations) ![]u8 {
    var out = std.ArrayList(u8).init(allocator);
    errdefer out.deinit();
    try out.append('{');
    var first = true;

    inline for (operation_order) |name| {
        if (try operationValue(allocator, operations, name)) |value| {
            defer allocator.free(value);
            if (!first) try out.append(',');
            first = false;
            try std.json.stringify(name, .{}, out.writer());
            try out.append(':');
            if (isNumericOrBool(name, operations)) {
                try out.appendSlice(value);
            } else {
                try std.json.stringify(value, .{}, out.writer());
            }
        }
    }

    try out.append('}');
    return out.toOwnedSlice();
}

fn isNumericOrBool(name: []const u8, ops: Operations) bool {
    if (std.mem.eql(u8, name, "fit") or
        std.mem.eql(u8, name, "background") or
        std.mem.eql(u8, name, "crop") or
        std.mem.eql(u8, name, "cropOffset") or
        std.mem.eql(u8, name, "colorize") or
        std.mem.eql(u8, name, "convertTo")) return false;
    _ = ops;
    return true;
}

fn decodeRpcResponse(allocator: std.mem.Allocator, payload: []const u8) !Response {
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, payload, .{});
    defer parsed.deinit();

    const root = parsed.value.object;
    if (root.get("error")) |_| return Error.HttpRequestFailed;
    const result = root.get("result") orelse return Error.HttpRequestFailed;
    const image = result.object.get("image") orelse return Error.HttpRequestFailed;
    const image_text = image.string;

    const decoded_len = try std.base64.standard.Decoder.calcSizeForSlice(image_text);
    const body = try allocator.alloc(u8, decoded_len);
    errdefer allocator.free(body);
    try std.base64.standard.Decoder.decode(body, image_text);

    return .{
        .status = 200,
        .content_type = if (result.object.get("contentType")) |ct| ct.string else "application/octet-stream",
        .body = body,
        .allocator = allocator,
    };
}

test "query string uses canonical operation order" {
    const allocator = std.testing.allocator;
    var client = Client.init(allocator, "http://localhost:3001");
    var transform = client.transform(Input.fromBytes(&.{}, "photo.jpg"));
    _ = try transform.convert("webp");
    _ = try transform.resize(800, 600);
    _ = try transform.blur(3);
    _ = transform.grayscale();

    const query = try queryString(allocator, transform.operations);
    defer allocator.free(query);

    try std.testing.expectEqualStrings("width=800&height=600&blur=3&grayscale=true&convertTo=webp", query);
}

test "base URL protocol follows transport family" {
    const allocator = std.testing.allocator;

    const http_default = try httpBase(allocator, "localhost:3001");
    defer allocator.free(http_default);
    try std.testing.expectEqualStrings("https://localhost:3001", http_default);

    const http_explicit = try httpBase(allocator, "http://localhost:3001/");
    defer allocator.free(http_explicit);
    try std.testing.expectEqualStrings("http://localhost:3001", http_explicit);

    const ws_explicit = try wsBase(allocator, "http://localhost:3002");
    defer allocator.free(ws_explicit);
    try std.testing.expectEqualStrings("ws://localhost:3002", ws_explicit);
}

test "validates operation ranges" {
    const allocator = std.testing.allocator;
    var client = Client.init(allocator, "http://localhost:3001");
    var transform = client.transform(Input.fromBytes(&.{}, "photo.jpg"));

    try std.testing.expectError(Error.InvalidOperation, transform.width(-1));
    try std.testing.expectError(Error.InvalidOperation, transform.quality(200));
    try std.testing.expectError(Error.InvalidOperation, transform.convert("bmp"));
}

test "content type guessing matches other clients" {
    try std.testing.expectEqualStrings("image/jpeg", guessContentType("photo.jpeg"));
    try std.testing.expectEqualStrings("image/heif", guessContentType("photo.heic"));
    try std.testing.expectEqualStrings("application/octet-stream", guessContentType("photo.bin"));
}
