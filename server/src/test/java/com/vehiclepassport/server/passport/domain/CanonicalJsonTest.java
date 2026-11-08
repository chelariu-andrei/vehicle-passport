package com.vehiclepassport.server.passport.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.passport.domain.model.CanonicalJson;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CanonicalJsonTest {

    @Test
    void sorts_keys() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("b", 1);
        m.put("a", 2);
        assertEquals("{\"a\":2,\"b\":1}", CanonicalJson.write(m));
    }

    @Test
    void omits_nulls() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("a", null);
        m.put("b", "x");
        assertEquals("{\"b\":\"x\"}", CanonicalJson.write(m));
    }

    @Test
    void no_whitespace() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("k", List.of(1, Map.of("z", true), "a b"));
        assertEquals("{\"k\":[1,{\"z\":true},\"a b\"]}", CanonicalJson.write(m));
    }

    @Test
    void escapes_quote_backslash_newline() {
        assertEquals("\"a\\\"b\\\\c\\n\"", CanonicalJson.write("a\"b\\c\n"));
    }

    @Test
    void control_char_as_u00XX() {
        assertEquals("\"\\u0001\"", CanonicalJson.write("" + (char) 1));
        assertEquals("\"\\u001f\"", CanonicalJson.write("" + (char) 0x1f));
    }

    @Test
    void non_ascii_is_raw() {
        String s = "\u0219" + new String(Character.toChars(0x1F600));
        assertEquals("\"" + s + "\"", CanonicalJson.write(s));
    }

    @Test
    void array_order_preserved() {
        assertEquals("[3,1,2]", CanonicalJson.write(List.of(3, 1, 2)));
    }
}
