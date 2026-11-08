package com.vehiclepassport.server;

import io.quarkiverse.cucumber.CucumberOptions;
import io.quarkiverse.cucumber.CucumberQuarkusTest;

@CucumberOptions(features = "classpath:features", glue = "com.vehiclepassport.server")
public class BehaviourIT extends CucumberQuarkusTest {
}
