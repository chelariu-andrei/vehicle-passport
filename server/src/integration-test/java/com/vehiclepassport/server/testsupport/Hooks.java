package com.vehiclepassport.server.testsupport;

import io.cucumber.java.Before;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

@ApplicationScoped
public class Hooks {

    @Inject
    World world;

    @Inject
    @Any
    Instance<Resettable> resettables;

    @Before
    public void resetState() {
        world.reset();
        resettables.forEach(Resettable::reset);
    }
}
