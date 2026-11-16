package com.vehiclepassport.server.account.api;

import com.vehiclepassport.server.account.api.dto.LegalDocumentDto;
import com.vehiclepassport.server.account.api.dto.LegalDocumentSummaryDto;
import com.vehiclepassport.server.account.api.dto.LegalDocumentsResponse;
import com.vehiclepassport.server.account.application.port.in.GetLegalDocumentUseCase;
import com.vehiclepassport.server.account.application.port.in.ListLegalDocumentsUseCase;
import com.vehiclepassport.server.account.domain.exception.LegalDocumentNotFoundException;
import com.vehiclepassport.server.account.domain.exception.ValidationFailedException;
import com.vehiclepassport.server.account.domain.model.LegalDocument;
import com.vehiclepassport.server.account.domain.model.LegalDocumentType;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/public/legal/documents")
@Produces(MediaType.APPLICATION_JSON)
public class LegalResource {

    @Inject
    ListLegalDocumentsUseCase listing;
    @Inject
    GetLegalDocumentUseCase getting;

    @GET
    public LegalDocumentsResponse list(@QueryParam("locale") String locale) {
        return new LegalDocumentsResponse(listing.list(locale).stream().map(LegalResource::summary).toList());
    }

    @GET
    @Path("/{type}")
    public LegalDocumentDto get(@PathParam("type") String type, @QueryParam("locale") String locale) {
        return full(getting.get(parse(type), locale));
    }

    private static LegalDocumentType parse(String type) {
        try {
            return LegalDocumentType.fromValue(type);
        } catch (ValidationFailedException e) {
            throw new LegalDocumentNotFoundException("Unknown legal document type: " + type);
        }
    }

    private static LegalDocumentSummaryDto summary(LegalDocument d) {
        return new LegalDocumentSummaryDto(d.type().value(), d.version(), d.locale(), d.title(),
                d.effectiveDate().toString());
    }

    private static LegalDocumentDto full(LegalDocument d) {
        return new LegalDocumentDto(d.type().value(), d.version(), d.locale(), d.title(), d.bodyMarkdown(),
                d.effectiveDate().toString());
    }
}
