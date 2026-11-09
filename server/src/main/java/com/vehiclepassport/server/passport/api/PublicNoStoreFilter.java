package com.vehiclepassport.server.passport.api;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.ext.Provider;

/** A revoked link must stop working at once, so nothing under /public may be cached, errors included. */
@Provider
public class PublicNoStoreFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        String path = request.getUriInfo().getPath();
        if (path.startsWith("/public/") || path.startsWith("public/")) {
            response.getHeaders().putSingle(HttpHeaders.CACHE_CONTROL, "no-store");
        }
    }
}
