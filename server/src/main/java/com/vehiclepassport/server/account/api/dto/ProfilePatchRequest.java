package com.vehiclepassport.server.account.api.dto;

import com.fasterxml.jackson.annotation.JsonSetter;

/**
 * PATCH body. A setter only runs for keys present in the JSON, so {@code displayNameGiven} tells an absent key
 * (unchanged) from an explicit null (clear).
 */
public class ProfilePatchRequest {

    private boolean displayNameGiven;
    private String displayName;
    private boolean phoneGiven;
    private String phone;

    @JsonSetter("displayName")
    public void setDisplayName(String displayName) {
        this.displayNameGiven = true;
        this.displayName = displayName;
    }

    @JsonSetter("phone")
    public void setPhone(String phone) {
        this.phoneGiven = true;
        this.phone = phone;
    }

    public boolean displayNameGiven() {
        return displayNameGiven;
    }

    public String displayName() {
        return displayName;
    }

    public boolean phoneGiven() {
        return phoneGiven;
    }

    public String phone() {
        return phone;
    }
}
