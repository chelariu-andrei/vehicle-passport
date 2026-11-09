import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aPassport, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/passport.feature', { loadRelativePath: true });

const SOLD_VIN = 'WBAZZZ1JZXW000002';
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const detailUrl = (id: string) => `/passports/${id}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

/** Opens one passport's detail with its car in the garage. */
async function openDetail(passport = aPassport()): Promise<{ fake: FakeApi; passport: ReturnType<typeof aPassport> }> {
  const fake = await openApp(detailUrl(passport.id), {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.passports.push(passport);
    },
  });
  expect(await screen.findByText(en.passport.frozen)).toBeTruthy();
  return { fake, passport };
}

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let passport = aPassport();

  test('Expiry comes from the server', ({ given, then }) => {
    given('a passport whose status is EXPIRED', async () => {
      ({ fake, passport } = await openDetail(aPassport({ status: 'EXPIRED', expiresAt: '2020-01-01T00:00:00Z' })));
    });
    then('it is shown as expired, without a QR code', () => {
      expect(screen.getByText(en.passport.status.EXPIRED)).toBeTruthy();
      expect(screen.queryByLabelText(en.passport.qrLabel)).toBeNull();
      expect(screen.queryByRole('button', { name: en.passport.shareLink })).toBeNull();
    });
  });

  test("A passport for a sold car stays manageable", ({ given, then }) => {
    given("my passport's VIN is no longer in my garage", async () => {
      passport = aPassport({ vin: SOLD_VIN });
      fake = await openApp('/passports', {
        seed: (api) => {
          api.state.vehicles.push(aVehicle());
          api.state.passports.push(passport);
        },
      });
    });
    then('it is listed under its VIN and I can revoke it', async () => {
      await fireEvent.press(await screen.findByRole('button', { name: new RegExp(SOLD_VIN) }));
      await press(en.passport.revoke);
      await press(en.passport.revokeConfirm);
      await waitFor(() => expect(fake.state.passports[0].status).toBe('REVOKED'));
      expect(await screen.findByText(en.passport.status.REVOKED)).toBeTruthy();
    });
  });

  test('The freeze is explained before creating', ({ when, then }) => {
    when('I open Create passport', async () => {
      fake = await openApp(`/vehicles/${SAMPLE_VIN}/passports/new`, { seed: (api) => api.state.vehicles.push(aVehicle()) });
    });
    then('I am told later events will not appear', async () => {
      expect(await screen.findByText(en.passport.freezeBody)).toBeTruthy();
    });
  });

  test('No expiry sends no date', ({ when, then }) => {
    when('I create a passport with "No expiry"', async () => {
      fake = await openApp(`/vehicles/${SAMPLE_VIN}/passports/new`, { seed: (api) => api.state.vehicles.push(aVehicle()) });
      await fireEvent.press(await screen.findByRole('radio', { name: en.passport.expiry.none }));
      await press(en.passport.createSubmit);
    });
    then('the request has no body', async () => {
      await waitFor(() => expect(fake.callsTo('createPassport')).toHaveLength(1));
      expect(fake.callsTo('createPassport')[0].body).toBeUndefined();
      // Creating opens the new passport.
      expect(await screen.findByText(en.passport.frozen)).toBeTruthy();
      expect(screen).toHavePathname(detailUrl(fake.state.passports[0].id));
    });
  });

  test('A live passport can be shared', ({ given, then }) => {
    given('an ACTIVE passport', async () => {
      ({ fake, passport } = await openDetail());
    });
    then('I see its QR code, Share link, Save PDF and See what a buyer sees', async () => {
      const qr = await screen.findByLabelText(en.passport.qrLabel);
      expect(qr.props.source.uri).toMatch(new RegExp(`/passports/${passport.id}/qr$`));
      expect(qr.props.source.headers.Authorization).toMatch(/^Bearer /);
      expect(qr.props.cachePolicy).toBe('none');
      for (const name of [en.passport.shareLink, en.passport.savePdf, en.passport.buyerView]) {
        expect(screen.getByRole('button', { name })).toBeTruthy();
      }
    });
  });

  test('Revoking asks first', ({ given, when, then }) => {
    given('an ACTIVE passport', async () => {
      ({ fake, passport } = await openDetail());
    });
    when('I choose Revoke and confirm', async () => {
      await press(en.passport.revoke);
      expect(await screen.findByText(en.passport.revokeTitle)).toBeTruthy();
      expect(fake.callsTo('revokePassport')).toHaveLength(0);
      await press(en.passport.revokeConfirm);
    });
    then('it is shown as revoked, without a QR code', async () => {
      expect(await screen.findByText(en.passport.status.REVOKED)).toBeTruthy();
      expect(fake.callsTo('revokePassport')).toHaveLength(1);
      expect(screen.queryByLabelText(en.passport.qrLabel)).toBeNull();
    });
  });

  test('Passports are never called verified', ({ given, then, and }) => {
    given('an ACTIVE passport', async () => {
      ({ fake, passport } = await openDetail());
    });
    then('I see "Frozen snapshot"', () => {
      expect(screen.getByText('Frozen snapshot')).toBeTruthy();
    });
    and('the word "verified" does not appear', () => {
      const rendered = JSON.stringify(screen.toJSON());
      expect(rendered).not.toMatch(/verified/i);
      // The champagne seal is reserved for evidence the API called VERIFIED.
      expect(rendered).not.toMatch(/#e9d28f|#7a5c0a/i);
    });
  });

  test('The buyer view opens the public page', ({ when, then }) => {
    when('I choose See what a buyer sees', async () => {
      ({ fake, passport } = await openDetail());
      await press(en.passport.buyerView);
    });
    then("the in-app browser opens the passport's publicUrl", async () => {
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(passport.publicUrl));
    });
  });

  test('Saving the PDF', ({ when, then }) => {
    when('I choose Save PDF', async () => {
      ({ fake, passport } = await openDetail());
      await press(en.passport.savePdf);
    });
    then('the system share sheet opens with a PDF', async () => {
      await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
      expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), expect.objectContaining({ mimeType: 'application/pdf' }));
      expect(fake.callsTo('getPassportPdf')).toHaveLength(1);
    });
  });
});
