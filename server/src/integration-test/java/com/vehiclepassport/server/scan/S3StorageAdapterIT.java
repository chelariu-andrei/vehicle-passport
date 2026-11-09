package com.vehiclepassport.server.scan;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.scan.infrastructure.client.SupabaseS3StorageAdapter;
import com.vehiclepassport.server.shared.config.StorageConfig;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

/**
 * Plain JUnit against an S3-compatible container: no Quarkus. The minio/minio image cannot be pulled in
 * this environment, so adobe/s3mock stands in; the adapter only uses put and get object.
 */
class S3StorageAdapterIT {

    private static final String IMAGE = "adobe/s3mock:latest";
    private static final String BUCKET = "vehicle-passport";
    private static GenericContainer<?> minio;
    private static S3Client s3;
    private static SupabaseS3StorageAdapter adapter;

    @BeforeAll
    static void start() {
        minio = new GenericContainer<>(IMAGE).withExposedPorts(9090)
                .waitingFor(Wait.forListeningPort());
        minio.start();
        String endpoint = "http://" + minio.getHost() + ":" + minio.getMappedPort(9090);
        s3 = S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("minioadmin", "minioadmin")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .httpClient(UrlConnectionHttpClient.create()).build();
        s3.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build());
        adapter = new SupabaseS3StorageAdapter(s3, new StorageConfig() {
            @Override
            public String endpoint() {
                return endpoint;
            }

            @Override
            public String region() {
                return "us-east-1";
            }

            @Override
            public String accessKey() {
                return "minioadmin";
            }

            @Override
            public String secretKey() {
                return "minioadmin";
            }

            @Override
            public String bucket() {
                return BUCKET;
            }
        });
    }

    @AfterAll
    static void stop() {
        if (s3 != null) {
            s3.close();
        }
        if (minio != null) {
            minio.stop();
        }
    }

    private static Path file(byte[] content) throws Exception {
        Path path = Files.createTempFile("scan-s3-", ".bin");
        Files.write(path, content);
        path.toFile().deleteOnExit();
        return path;
    }

    @Test
    void put_then_read_returns_same_bytes() throws Exception {
        byte[] content = {(byte) 0x89, 0x50, 0x4E, 0x47, 0, 1, 2, 3, (byte) 0xFF};

        adapter.put("scans/VIN/roundtrip", file(content), "image/png");

        assertArrayEquals(content, adapter.read("scans/VIN/roundtrip"));
    }

    @Test
    void content_type_is_preserved() throws Exception {
        adapter.put("scans/VIN/typed", file("%PDF-1.4".getBytes()), "application/pdf");

        String type = s3.headObject(HeadObjectRequest.builder().bucket(BUCKET).key("scans/VIN/typed").build())
                .contentType();

        assertEquals("application/pdf", type);
    }

    @Test
    void read_missing_key_throws() {
        assertThrows(IllegalStateException.class, () -> adapter.read("scans/VIN/missing"));
    }
}
