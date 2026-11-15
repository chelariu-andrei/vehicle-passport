import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AccessibilityInfo, Animated } from 'react-native';

import { errorMessage, isApiError } from '@/shared/api';
import { useSession } from '@/shared/auth/session';
import { ActionBar, AppBar, Button, Screen, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';
import { NEUTRAL_LOOK } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

import { useActiveCar } from '../../api/useActiveCar';
import { useJourneyDraft } from '../../api/useJourneyDraft';
import { useRegisterVehicle } from '../../api/useRegisterVehicle';
import { autoJourney } from '../../model/autoJourney';
import { EMPTY_DRAFT, isBlank } from '../../model/journeyDraft';
import type { JourneyDraft } from '../../model/journeyDraft';
import { vehicleFormSchema } from '../../model/vehicleForm';
import type { VehicleFormValues } from '../../model/vehicleForm';
import { isVin, makeFromVin } from '../../model/vin';
import { ClaimFiled } from './ClaimFiled';
import { DraftSheet } from './DraftSheet';
import { JourneyDone } from './JourneyDone';
import { JourneyLook } from './JourneyLook';
import type { JourneyFormInput } from './form';
import { StepDetails } from './StepDetails';
import { StepProgress } from './StepProgress';
import { StepVin } from './StepVin';

/** The part of the screen's navigation the journey uses. */
type ScreenNavigation = {
  addListener(type: 'focus', listener: () => void): () => void;
  setOptions(options: { gestureEnabled: boolean }): void;
};

export type Step = 'vin' | 'details' | 'look' | 'done' | 'claim';

const SLIDE = 24;
const SLIDE_MS = 200;

/** One screen per step slides in from the side; under Reduce Motion it simply appears. */
function StepTransition({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const [progress] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (animate) Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, useNativeDriver: true }).start();
  }, [animate, progress]);
  return (
    <Animated.View
      style={{
        flex: 1,
        gap: tokens.space['space-4'],
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [SLIDE, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function useReduceMotion(): boolean {
  // Until the system answers, assume the careful setting.
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => live && setReduce(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

type DraftApi = ReturnType<typeof useJourneyDraft>;

function Journey({ auto, initial, draft }: { auto: boolean; initial: JourneyDraft; draft: DraftApi }) {
  const navigation = useNavigation<ScreenNavigation>();
  const { status: sessionStatus } = useSession();
  const { select } = useActiveCar();
  const register = useRegisterVehicle();
  const reduceMotion = useReduceMotion();
  const leaveScreen = useBack('/');
  const schema = useMemo(() => vehicleFormSchema(new Date()), []);
  const { control, handleSubmit, getValues, setValue, formState } = useForm<JourneyFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vin: initial.vin,
      make: initial.make,
      model: initial.model,
      year: initial.year,
      engine: initial.engine,
      fuel: initial.fuel ?? undefined,
    },
  });
  const [step, setStep] = useState<Step>(initial.step === 'details' && isVin(initial.vin) ? 'details' : 'vin');
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [created, setCreated] = useState<{ vin: string; name: string; look: Look } | null>(null);
  const values = useWatch({ control });
  const vin = values.vin ?? '';

  // The back listener is registered once; it reads what is current through here.
  const stepRef = useRef(step);
  const sessionRef = useRef(sessionStatus);
  useEffect(() => {
    stepRef.current = step;
    sessionRef.current = sessionStatus;
  });
  const submitted = useRef(false);
  const lastSuggestion = useRef<string | null>(null);

  const snapshot = (): JourneyDraft => {
    const values = getValues();
    return {
      step: stepRef.current === 'details' ? 'details' : 'vin',
      vin: values.vin ?? '',
      make: values.make ?? '',
      model: values.model ?? '',
      year: String(values.year ?? ''),
      engine: values.engine ?? '',
      fuel: values.fuel ?? null,
    };
  };

  // Everything typed is mirrored into the draft once typing pauses. A submitted car leaves nothing behind.
  const saveDraft = draft.save;
  useEffect(() => {
    if (!submitted.current && (step === 'vin' || step === 'details')) saveDraft(snapshot());
    // `snapshot` only reads refs and the form; typing and a change of step are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, step, saveDraft]);

  // The swipe is for steps 1 and 2; once the car is saved there is nothing to go back to.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step !== 'look' });
  }, [navigation, step]);

  const leave = () => {
    // "Later" on an automatic start holds the automatic start back until the app is next launched.
    if (auto) autoJourney.dismiss();
    setLeaving(true);
  };
  // The pop waits for the guard below to let go; a pop that did not happen must not leave the guard off.
  useEffect(() => {
    if (leaving) leaveScreen();
  }, [leaving, leaveScreen]);
  useEffect(() => navigation.addListener('focus', () => setLeaving(false)), [navigation]);
  // Leaving by Back from an empty step 1 passes the guard untouched; the automatic start still stands down.
  useEffect(
    () => () => {
      if (auto && sessionRef.current === 'signedIn') autoJourney.dismiss();
    },
    [auto],
  );

  /** Back or "Later" on step 1: with something typed, ask; with nothing, just go. */
  const leaveFromVin = () => {
    if (isBlank(snapshot())) {
      draft.clear();
      leave();
    } else {
      setAsking(true);
    }
  };
  const keepDraft = () => {
    draft.saveNow(snapshot());
    leave();
  };
  const discardDraft = () => {
    draft.clear();
    leave();
  };

  const backFromDetails = () => setStep('vin');

  // The guard is a native one, so the iOS edge swipe is held back before it starts. Step 1 is guarded only while
  // something is typed. A sign-out or a reset of the stack is not a person going back: it is let through.
  const typed = Boolean(values.vin || values.make || values.model || values.year || values.engine || values.fuel);
  const guard = !leaving && sessionStatus === 'signedIn' && (step === 'details' || step === 'look' || (step === 'vin' && typed));
  usePreventRemove(guard, ({ data, repeat }) => {
    const type = data.action.type;
    if (type !== 'GO_BACK' && type !== 'POP') repeat();
    else if (step === 'details') backFromDetails();
    else if (step === 'vin') leaveFromVin();
  });

  const edited = () => {
    // A settled server error clears on the next edit. A request in flight must never be reset: that would detach its callbacks.
    if (register.isError) register.reset();
  };

  const toDetails = () => {
    const suggestion = makeFromVin(getValues('vin'));
    const make = getValues('make');
    // The suggestion fills an empty Make, or replaces an earlier suggestion; what the person typed is left alone.
    if (suggestion && (!make || make === lastSuggestion.current)) setValue('make', suggestion);
    lastSuggestion.current = suggestion;
    setStep('details');
  };

  const submit = () => {
    void handleSubmit((values) => {
      register.mutate(values, {
        onSuccess: (result) => {
          submitted.current = true;
          draft.clear();
          if (result.kind === 'created') {
            select(result.vehicle.vin);
            setCreated({ vin: result.vehicle.vin, name: `${result.vehicle.make} ${result.vehicle.model}`, look: NEUTRAL_LOOK });
            setStep('look');
          } else {
            setStep('claim');
          }
        },
        onError: (error) => {
          if (isApiError(error, 'invalid-vin')) setStep('vin');
        },
      });
    })();
  };

  const failure = register.isError ? register.error : null;
  const vinProblem = isApiError(failure, 'invalid-vin') ? errorMessage(failure) : undefined;
  const alreadyMine = isApiError(failure, 'already-owner');
  const formProblem = failure && !isApiError(failure, 'invalid-vin') ? errorMessage(failure) : null;

  const viewCar = () => {
    submitted.current = true;
    draft.clear();
    select(getValues('vin'));
    leave();
  };

  if (step === 'look' && created) {
    return <JourneyLook vin={created.vin} onDone={(look) => { setCreated({ ...created, look }); setStep('done'); }} />;
  }
  if (step === 'done' && created) return <JourneyDone vin={created.vin} name={created.name} look={created.look} />;

  const header =
    step === 'details' ? (
      <AppBar onBack={backFromDetails} />
    ) : step === 'vin' && !auto ? (
      <AppBar onBack={leaveFromVin} />
    ) : (
      <AppBar />
    );

  const footer =
    step === 'vin' ? (
      <ActionBar
        primary={{ title: en.journey.continue, disabled: !isVin(vin), onPress: toDetails }}
        quiet={{ title: en.journey.later, onPress: leaveFromVin }}
      />
    ) : step === 'details' ? (
      <ActionBar primary={{ title: en.journey.submit, loading: register.isPending, onPress: submit }} />
    ) : step === 'claim' ? (
      <ActionBar primary={{ title: en.journey.done, onPress: leave }} />
    ) : undefined;

  const progress = step === 'vin' ? 1 : step === 'details' ? 2 : null;

  return (
    <Screen
      scroll={step === 'vin' || step === 'details'}
      header={
        <>
          {header}
          {progress ? <StepProgress step={progress} /> : null}
        </>
      }
      footer={footer}
    >
      <StepTransition key={step} animate={!reduceMotion}>
        {step === 'vin' ? <StepVin control={control} error={vinProblem} onEdit={edited} /> : null}
        {step === 'details' ? (
          <>
            <StepDetails control={control} errors={formState.errors} suggested={makeFromVin(vin) !== null} onEdit={edited} />
            {formProblem ? (
              <Text color="danger" accessibilityRole="alert">
                {formProblem}
              </Text>
            ) : null}
            {alreadyMine ? <Button kind="secondary" title={en.journey.viewCar} onPress={viewCar} /> : null}
          </>
        ) : null}
        {step === 'claim' ? <ClaimFiled /> : null}
      </StepTransition>
      <DraftSheet visible={asking} onKeep={keepDraft} onDiscard={discardDraft} onClose={() => setAsking(false)} />
    </Screen>
  );
}

/** The add-a-car journey. `auto` is set when the app opened it by itself in an empty garage. */
export function JourneyScreen({ auto }: { auto: boolean }) {
  const draft = useJourneyDraft();
  // The form starts from the saved draft, so it waits for the draft to be read.
  if (!draft.loaded) return <Screen>{null}</Screen>;
  return <Journey auto={auto} initial={draft.draft ?? EMPTY_DRAFT} draft={draft} />;
}
