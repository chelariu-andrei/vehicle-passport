package com.vehiclepassport.server.passport.infrastructure;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.vehiclepassport.server.passport.infrastructure.client.QrCodeAdapter;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class QrCodeAdapterTest {

    @Test
    void decoded_png_equals_input_url() throws Exception {
        String url = "https://example.com/p/abcDEF_123-token";
        byte[] png = new QrCodeAdapter().png(url);
        var image = ImageIO.read(new ByteArrayInputStream(png));
        var bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image)));
        assertEquals(url, new MultiFormatReader().decode(bitmap).getText());
    }
}
