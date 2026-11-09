package com.vehiclepassport.server.scan.application.port.in;

import java.nio.file.Path;

/** A received upload on local disk. Deliberately has no client file name: it must never reach storage. */
public record UploadedFile(Path path, String contentType, long size) {
}
