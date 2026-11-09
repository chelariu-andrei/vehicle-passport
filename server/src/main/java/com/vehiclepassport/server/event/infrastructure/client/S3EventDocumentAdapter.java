package com.vehiclepassport.server.event.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.shared.config.StorageConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

@ApplicationScoped
public class S3EventDocumentAdapter implements DocumentStoragePort {

    private final S3Client s3;
    private final StorageConfig config;

    @Inject
    public S3EventDocumentAdapter(S3Client s3, StorageConfig config) {
        this.s3 = s3;
        this.config = config;
    }

    @Override
    public EventDocument open(String key) {
        try {
            ResponseInputStream<GetObjectResponse> object = s3.getObject(
                    GetObjectRequest.builder().bucket(config.bucket()).key(key).build());
            return new EventDocument(object, object.response().contentType());
        } catch (NoSuchKeyException e) {
            throw new EventNotFoundException("The document of this event is no longer available");
        }
    }
}
