import { useQueries, useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useMe } from '@/features/account';
import { useSettings } from '@/features/settings';
import { useVehicles } from '@/features/vehicle';

import { deadlinesQuery } from '../api/useDeadlines';
import { ReminderPermissionSheet } from '../components/ReminderPermissionSheet';
import { reminderPlan, type PlanCar, type PlannedReminder } from '../model/reminderPlan';
import { readPermission, reminderPrompt, requestPermission, type PermissionState } from './permission';
import { applyPlan, cancelAll } from './scheduler';
import { lastTiresQuery } from './tiresQuery';

/*
 * Every change to the phone's scheduled notifications goes through one queue, so a cancel asked for at sign-out always runs
 * after a plan still being scheduled, never in the middle of it.
 */
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((error: unknown) => console.warn('Could not update the scheduled reminders', error));
  return queue;
}

/** Removes every scheduled reminder: nobody is signed in, or the account changed. */
export function cancelReminders(): Promise<void> {
  return enqueue(() => cancelAll());
}

/** What the phone's notifications should be: not known yet, none at all, or exactly a plan. */
type Target = { kind: 'wait' } | { kind: 'off' } | { kind: 'plan'; plan: PlannedReminder[]; signature: string };

const OFF = 'off';

/** Only what the person would notice: when, what it says and where a tap goes. */
function signatureOf(plan: PlannedReminder[]): string {
  return JSON.stringify(plan.map((r) => [r.fireAt.getTime(), r.title, r.body, r.data.vin, r.data.kind]));
}

const isReminderInput = (query: Query) =>
  query.queryKey[0] === 'timeline' && (query.queryKey[2] === 'deadlines' || query.queryKey[2] === 'lastTires');

/**
 * Keeps the phone's scheduled reminders equal to the plan built from the garage, each car's documents and the account's
 * notification settings. Mounted while signed in. Schedules only with the system permission; asks for it (after a short
 * explanation, once per phone) the first time there is something to remind.
 */
export function ReminderSync() {
  const client = useQueryClient();
  const me = useMe().data;
  const allowed = me !== undefined && !me.consent.required;
  const prefs = useSettings(allowed).data?.notifications;
  const wanted = prefs !== undefined && (prefs.documentDeadlines || prefs.tireSeason);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [explained, setExplained] = useState<boolean | null>(null);
  const alive = useRef(true);
  // Nothing is loaded for reminders the phone could neither schedule nor ask about (refused, or "Not now" already said).
  const useful = permission === 'granted' || (permission === 'undetermined' && explained === false);
  const needed = allowed && wanted && useful;
  const garage = useVehicles(needed).data;
  const cars = needed ? (garage ?? []) : [];
  const deadlines = useQueries({
    queries: cars.map((car) => ({ ...deadlinesQuery(car.vin), enabled: prefs?.documentDeadlines === true })),
  });
  const tires = useQueries({
    queries: cars.map((car) => ({ ...lastTiresQuery(car.vin), enabled: prefs?.tireSeason === true })),
  });

  let target: Target = { kind: 'wait' };
  if (me !== undefined && !allowed) target = { kind: 'off' };
  else if (prefs !== undefined && !wanted) target = { kind: 'off' };
  else if (prefs !== undefined && garage !== undefined) {
    // A car whose data could not be loaded keeps the reminders already scheduled, rather than losing them.
    const loaded = cars.every(
      (_, i) => (!prefs.documentDeadlines || deadlines[i]?.data !== undefined) && (!prefs.tireSeason || tires[i]?.data !== undefined),
    );
    if (loaded) {
      const planCars: PlanCar[] = cars.map((car, i) => ({
        vin: car.vin,
        carName: `${car.make} ${car.model}`,
        items: deadlines[i]?.data?.items ?? [],
        lastTiresOn: tires[i]?.data ?? null,
      }));
      const plan = reminderPlan(planCars, prefs, new Date());
      target = { kind: 'plan', plan, signature: signatureOf(plan) };
    }
  }

  useEffect(() => {
    alive.current = true;
    const read = () => void readPermission().then((state) => alive.current && setPermission(state));
    read();
    void reminderPrompt.wasExplained().then((value) => alive.current && setExplained(value));
    // Back from the background (or from the phone's settings): the permission may have changed, and so may the documents.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      read();
      void client.invalidateQueries({ predicate: isReminderInput }, { cancelRefetch: false });
    });
    return () => {
      alive.current = false;
      subscription.remove();
    };
  }, [client]);

  // What was last sent to the phone: `OFF`, a plan's signature, or nothing yet. A re-render with the same plan sends nothing.
  const applied = useRef<string | null>(null);
  const planRef = useRef<PlannedReminder[]>([]);
  const latestPlan = target.kind === 'plan' ? target.plan : null;
  const key = target.kind === 'plan' ? target.signature : target.kind;

  // Declared before the effect below, so it always runs first and that effect sees the plan of this render.
  useEffect(() => {
    if (latestPlan) planRef.current = latestPlan;
  });

  useEffect(() => {
    if (key === 'wait') return;
    if (key === OFF) {
      if (applied.current === OFF) return;
      applied.current = OFF;
      void enqueue(() => cancelAll());
      return;
    }
    if (permission !== 'granted' || applied.current === key) return;
    applied.current = key;
    const plan = planRef.current;
    void enqueue(() => applyPlan(plan));
  }, [key, permission]);

  const allow = async () => {
    setExplained(true);
    await reminderPrompt.markExplained();
    await requestPermission();
    const state = await readPermission();
    if (alive.current) setPermission(state);
  };
  const notNow = () => {
    setExplained(true);
    void reminderPrompt.markExplained();
  };

  const ask = target.kind === 'plan' && target.plan.length > 0 && permission === 'undetermined' && explained === false;
  return <ReminderPermissionSheet visible={ask} onAllow={() => void allow()} onNotNow={notNow} />;
}
