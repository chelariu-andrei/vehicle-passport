package com.vehiclepassport.server.architecture;

import static com.tngtech.archunit.lang.SimpleConditionEvent.violated;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.CompositeArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import java.util.List;

@AnalyzeClasses(packages = "com.vehiclepassport.server", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String BASE = "com.vehiclepassport.server";
    private static final List<String> FEATURES = List.of("vehicle", "event", "scan", "passport", "account", "fuel");
    private static final String DOMAIN_EXCEPTION = BASE + ".shared.error.DomainException";
    private static final String ERROR_KIND = BASE + ".shared.error.ErrorKind";
    private static final String TRANSACTIONAL = "jakarta.transaction.Transactional";

    /** Feature owning the class, or null when it is outside the feature packages. */
    private static String featureOf(JavaClass c) {
        String pkg = c.getPackageName();
        for (String f : FEATURES) {
            if (inPackage(pkg, BASE + "." + f)) {
                return f;
            }
        }
        return null;
    }

    private static boolean inPackage(String pkg, String root) {
        return pkg.equals(root) || pkg.startsWith(root + ".");
    }

    @ArchTest
    static final ArchRule domain_is_pure = classes()
            .that().resideInAPackage("..domain..")
            .should(new ArchCondition<JavaClass>(
                    "depend only on java.., own feature domain, DomainException and ErrorKind") {
                @Override
                public void check(JavaClass origin, ConditionEvents events) {
                    String feature = featureOf(origin);
                    String ownDomain = feature == null ? null : BASE + "." + feature + ".domain";
                    for (Dependency d : origin.getDirectDependenciesFromSelf()) {
                        JavaClass target = d.getTargetClass();
                        JavaClass t = target.isArray() ? target.getBaseComponentType() : target;
                        String name = t.getName();
                        boolean ok = t.isPrimitive()
                                || name.startsWith("java.")
                                || name.equals(DOMAIN_EXCEPTION)
                                || name.equals(ERROR_KIND)
                                || (ownDomain != null && inPackage(t.getPackageName(), ownDomain));
                        if (!ok) {
                            events.add(violated(origin, d.getDescription()));
                        }
                    }
                }
            });

    @ArchTest
    static final ArchRule application_is_framework_free = noClasses()
            .that().resideInAPackage("..application..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "io.quarkus..", "org.hibernate..", "jakarta.persistence..", "jakarta.ws.rs..",
                    "com.fasterxml.jackson..", "..api..", "..infrastructure..");

    @ArchTest
    static final ArchRule api_does_not_reach_infrastructure = noClasses()
            .that().resideInAPackage("..api..")
            .should().dependOnClassesThat().resideInAnyPackage("..infrastructure..", "..application.port.out..");

    @ArchTest
    static final ArchRule nothing_depends_on_infrastructure = noClasses()
            .that().resideOutsideOfPackage("..infrastructure..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

    @ArchTest
    static final ArchRule cross_feature_only_via_port_in = classes()
            .should(new ArchCondition<JavaClass>("reach other features only through their application.port.in") {
                @Override
                public void check(JavaClass origin, ConditionEvents events) {
                    String from = featureOf(origin);
                    if (from == null) {
                        return;
                    }
                    for (Dependency d : origin.getDirectDependenciesFromSelf()) {
                        JavaClass t = d.getTargetClass();
                        String to = featureOf(t);
                        if (to == null || to.equals(from)) {
                            continue;
                        }
                        if (!inPackage(t.getPackageName(), BASE + "." + to + ".application.port.in")) {
                            events.add(violated(origin, d.getDescription()));
                        }
                    }
                }
            });

    @ArchTest
    static final ArchRule shared_is_independent = noClasses()
            .that().resideInAPackage("..shared..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    BASE + ".vehicle..", BASE + ".event..", BASE + ".scan..", BASE + ".passport..", BASE + ".account..", BASE + ".fuel..");

    @ArchTest
    static final ArchRule naming = CompositeArchRule
            .of(classes().that().areAnnotatedWith("jakarta.ws.rs.Path")
                    .should().haveSimpleNameEndingWith("Resource")
                    .andShould().resideInAPackage("..api.."))
            .and(classes().that().resideInAPackage("..application.port.in..")
                    .and().areInterfaces().and().areTopLevelClasses()
                    .should().haveSimpleNameEndingWith("UseCase"))
            .and(classes().that().resideInAPackage("..application.port.out..")
                    .and().areInterfaces().and().areTopLevelClasses()
                    .should().haveSimpleNameEndingWith("Port"))
            .and(classes().that().resideInAPackage("..application.service..")
                    .and().areTopLevelClasses()
                    .should().haveSimpleNameEndingWith("Service"))
            .and(classes().that().areAnnotatedWith("jakarta.persistence.Entity")
                    .should().haveSimpleNameEndingWith("Entity")
                    .andShould().resideInAPackage("..infrastructure.persistence.entity.."));

    @ArchTest
    static final ArchRule transactional_only_in_services = CompositeArchRule
            .of(noClasses().that().resideOutsideOfPackage("..application.service..")
                    .should().beAnnotatedWith(TRANSACTIONAL))
            .and(noMethods().that().areAnnotatedWith(TRANSACTIONAL)
                    .should().beDeclaredInClassesThat().resideOutsideOfPackage("..application.service.."));

    @ArchTest
    static final ArchRule dtos_stay_in_api = noClasses()
            .that().resideOutsideOfPackage("..api..")
            .should().dependOnClassesThat().resideInAPackage("..api.dto..");

    @ArchTest
    static final ArchRule dtos_do_not_use_domain = noClasses()
            .that().resideInAPackage("..api.dto..")
            .should().dependOnClassesThat().resideInAPackage("..domain..");

    @ArchTest
    static final ArchRule event_port_in_is_domain_free = noClasses()
            .that().resideInAPackage(BASE + ".event.application.port.in..")
            .should().dependOnClassesThat().resideInAPackage(BASE + ".event.domain..");

    @ArchTest
    static final ArchRule event_details_stay_in_domain = classes()
            .that().implement(BASE + ".event.domain.model.EventDetails")
            .should().resideInAPackage("..event.domain.model..");

    /** Feature policies only: shared.util.UploadPolicy is a cross-cutting upload check used by two features. */
    @ArchTest
    static final ArchRule policies_are_domain = classes()
            .that().haveSimpleNameEndingWith("Policy").and().areTopLevelClasses()
            .and().resideOutsideOfPackage(BASE + ".shared..")
            .should().resideInAPackage("..domain..");

    /** Fuel spec decision 2: the fuel calculators know nothing of the other features. */
    @ArchTest
    static final ArchRule fuel_domain_has_no_event_or_vehicle_dependency = noClasses()
            .that().resideInAPackage(BASE + ".fuel.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(BASE + ".event..", BASE + ".vehicle..");

    /**
     * Fuel spec decision 2: the odometer link is one-way, fuel asks event and event never looks at fuel readings.
     * Remove this rule on purpose if the odometer gap is ever closed with a shared odometer store.
     */
    @ArchTest
    static final ArchRule event_does_not_depend_on_fuel = noClasses()
            .that().resideInAPackage(BASE + ".event..")
            .should().dependOnClassesThat().resideInAPackage(BASE + ".fuel..");

    private static final String FUEL_CALCULATORS =
            BASE.replace(".", "\\.") + "\\.fuel\\.domain\\.model\\.(ConsumptionCalculator|ConsumptionAlert|CostMetrics)";

    /** No framework, no ports and no instance state: the numbers depend only on the arguments. */
    @ArchTest
    static final ArchRule fuel_calculators_are_pure = CompositeArchRule
            .of(noClasses().that().haveNameMatching(FUEL_CALCULATORS)
                    .should().dependOnClassesThat().resideInAnyPackage("jakarta..", "io.quarkus..", "..port.."))
            .and(fields().that().areDeclaredInClassesThat().haveNameMatching(FUEL_CALCULATORS)
                    .and().areNotStatic()
                    .should().beFinal()
                    .allowEmptyShould(true));

    @ArchTest
    static final ArchRule fuel_ports_out_are_implemented_in_infrastructure = classes()
            .that().resideInAPackage(BASE + ".fuel.application.port.out..").and().areInterfaces()
            .should(new ArchCondition<JavaClass>("have at least one implementation, all in fuel.infrastructure") {
                @Override
                public void check(JavaClass port, ConditionEvents events) {
                    List<JavaClass> implementations = port.getAllSubclasses().stream()
                            .filter(c -> !c.isInterface()).toList();
                    if (implementations.isEmpty()) {
                        events.add(violated(port, port.getName() + " has no implementation"));
                    }
                    for (JavaClass impl : implementations) {
                        if (!inPackage(impl.getPackageName(), BASE + ".fuel.infrastructure")) {
                            events.add(violated(port, impl.getName() + " implements " + port.getSimpleName()
                                    + " outside fuel.infrastructure"));
                        }
                    }
                }
            });

    @ArchTest
    static final ArchRule extraction_adapters_live_in_client = classes()
            .that().implement(BASE + ".scan.application.port.out.ReceiptExtractionPort")
            .should().resideInAPackage("..scan.infrastructure.client..");
}
