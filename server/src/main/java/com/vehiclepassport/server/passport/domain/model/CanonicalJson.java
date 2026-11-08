package com.vehiclepassport.server.passport.domain.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Deterministic JSON writer: sorted keys, no whitespace, nulls omitted, minimal escaping. */
public final class CanonicalJson {

    private CanonicalJson() {}

    public static String write(Object value) {
        StringBuilder sb = new StringBuilder();
        append(sb, value);
        return sb.toString();
    }

    private static void append(StringBuilder sb, Object value) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String s) {
            appendString(sb, s);
        } else if (value instanceof Boolean b) {
            sb.append(b.booleanValue());
        } else if (value instanceof BigDecimal d) {
            sb.append(d.toPlainString());
        } else if (value instanceof Number n) {
            sb.append(n);
        } else if (value instanceof Map<?, ?> m) {
            List<String> keys = new ArrayList<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (e.getValue() != null) {
                    keys.add((String) e.getKey());
                }
            }
            keys.sort(String::compareTo);
            sb.append('{');
            boolean first = true;
            for (String k : keys) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                appendString(sb, k);
                sb.append(':');
                append(sb, m.get(k));
            }
            sb.append('}');
        } else if (value instanceof List<?> l) {
            sb.append('[');
            boolean first = true;
            for (Object o : l) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                append(sb, o);
            }
            sb.append(']');
        } else {
            throw new IllegalArgumentException("Unsupported type: " + value.getClass());
        }
    }

    private static void appendString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\t' -> sb.append("\\t");
                case '\n' -> sb.append("\\n");
                case '\f' -> sb.append("\\f");
                case '\r' -> sb.append("\\r");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }
}
