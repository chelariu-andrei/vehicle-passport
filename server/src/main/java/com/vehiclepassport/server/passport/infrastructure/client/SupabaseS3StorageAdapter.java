package com.vehiclepassport.server.passport.infrastructure.client;

import com.vehiclepassport.server.passport.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.passport.domain.exception.PassportNotFoundException;
import com.vehiclepassport.server.shared.config.StorageConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@ApplicationScoped
public class SupabaseS3StorageAdapter implements DocumentStoragePort {

    private final S3Client s3;
    private final StorageConfig config;

    @Inject
    public SupabaseS3StorageAdapter(S3Client s3, StorageConfig config) {
        this.s3 = s3;
        this.config = config;
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        s3.putObject(PutObjectRequest.builder().bucket(config.bucket()).key(key).contentType(contentType).build(),
                RequestBody.fromBytes(content));
    }

    @Override
    public byte[] read(String key) {
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(config.bucket()).key(key).build())
                    .asByteArray();
        } catch (NoSuchKeyException e) {
            throw new PassportNotFoundException("The passport file is no longer available");
        }
    }
}
