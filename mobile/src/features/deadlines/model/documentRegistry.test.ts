import { en } from '@/shared/i18n/en';

import { EVENT_TYPE_CONFIG } from '@/features/event';
import { DOCUMENT_CONFIG, DOCUMENT_ORDER } from './documentRegistry';

describe('document registry', () => {
  it('lists the six documents in the order of the endpoint', () => {
    expect(DOCUMENT_ORDER).toEqual(['ITP', 'RCA', 'CASCO', 'ROVINIETA', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT']);
    expect(Object.keys(DOCUMENT_CONFIG).sort()).toEqual([...DOCUMENT_ORDER].sort());
  });

  it('marks only CASCO as optional', () => {
    expect(DOCUMENT_ORDER.filter((k) => DOCUMENT_CONFIG[k].optional)).toEqual(['CASCO']);
  });

  it('presets only event types the event registry knows, with the right coverage or item', () => {
    for (const kind of DOCUMENT_ORDER) expect(EVENT_TYPE_CONFIG[DOCUMENT_CONFIG[kind].preset.type]).toBeDefined();
    expect(DOCUMENT_CONFIG.RCA.preset).toEqual({ type: 'INSURANCE', coverage: 'RCA' });
    expect(DOCUMENT_CONFIG.CASCO.preset).toEqual({ type: 'INSURANCE', coverage: 'CASCO' });
    expect(DOCUMENT_CONFIG.FIRE_EXTINGUISHER.preset).toEqual({ type: 'SAFETY_EQUIPMENT', item: 'FIRE_EXTINGUISHER' });
  });

  it('labels every document', () => {
    expect(DOCUMENT_CONFIG.ROVINIETA.label()).toBe('Rovinietă');
    expect(DOCUMENT_CONFIG.FIRST_AID_KIT.label()).toBe('First-aid kit');
  });
});

describe('deadline notification copy', () => {
  const n = en.deadlines.notification;
  it('says how long is left', () => {
    expect(n.title('RCA', 7)).toBe('RCA expires in 7 days');
    expect(n.title('RCA', 1)).toBe('RCA expires in 1 day');
    expect(n.title('ITP', 0)).toBe('ITP expires today');
  });
  it('names the car in the body', () => {
    expect(n.body('Dacia Duster')).toBe('Dacia Duster. Open to review.');
  });
  it('has tire-season copy', () => {
    expect(n.tireTitle('winter')).toBe('Time for winter tires');
    expect(n.tireTitle('summer')).toBe('Time for summer tires');
    expect(n.tireBody('Dacia Duster')).toContain('Dacia Duster');
  });
  it('lists the reminder days in the footer', () => {
    expect(en.deadlines.footerOn([30, 7, 1])).toBe('Reminders: 30, 7 and 1 day before, and on the expiry day');
    expect(en.deadlines.footerOn([])).toBe('Reminders: on the expiry day');
  });
});
