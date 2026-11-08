package com.vehiclepassport.server.architecture;

import static com.tngtech.archunit.lang.SimpleConditionEvent.violated;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
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
    private static final List<String> FEATURES = List.of("vehicle", "event", "scan", "passport");
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
                        JavaClass t = d.getTargetClass();
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
                    BASE + ".vehicle..", BASE + ".event..", BASE + ".scan..", BASE + ".passport..");

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
}
