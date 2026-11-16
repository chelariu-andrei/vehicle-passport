import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { isApiError } from '@/shared/api';
import { errorMessage } from '@/shared/api/errorMessage';
import { useIsOnline } from '@/shared/api/onlineStatus';
import { AppBar, Button, Card, Field, Icon, Screen, Switch, Text, toast, tokens, useTheme } from '@/shared/design';
import { useStrings, useValidationMessage } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';
import { supportMessageSchema } from '@/shared/validation';

import { useCreateSupportReport } from '../api/useSupport';
import { collectDiagnostics, DIAGNOSTIC_FIELDS } from '../model/diagnostics';

const MAX_LENGTH = 4000;
type Kind = 'problem' | 'question';

/** Account > Contact support: a message, and optionally the device details, to the support team. */
export function SupportScreen() {
  const s = useStrings();
  const { colors } = useTheme();
  const localized = useValidationMessage();
  const back = useBack('/account');
  const online = useIsOnline();
  const send = useCreateSupportReport();
  const [kind, setKind] = useState<Kind>('problem');
  const [message, setMessage] = useState('');
  // Off until the person turns it on: nothing about the phone leaves it by default.
  const [diagnostics, setDiagnostics] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [failure, setFailure] = useState<string>();

  const submit = () => {
    const parsed = supportMessageSchema.safeParse(message.trim());
    if (!parsed.success) {
      setFieldError(localized(parsed.error.issues[0]?.message));
      return;
    }
    setFieldError(undefined);
    if (!online) {
      setFailure(s.support.offline);
      return;
    }
    setFailure(undefined);
    send.mutate(
      { kind, message: parsed.data, includeDiagnostics: diagnostics, ...(diagnostics ? { diagnostics: collectDiagnostics() } : {}) },
      {
        onSuccess: () => {
          toast(s.support.sent);
          setMessage('');
          setDiagnostics(false);
        },
        // The draft stays; the Send button doubles as the retry.
        onError: (error) => setFailure(isApiError(error) ? errorMessage(error) : s.support.offline),
      },
    );
  };

  const kinds: { value: Kind; label: string }[] = [
    { value: 'problem', label: s.support.problem },
    { value: 'question', label: s.support.question },
  ];
  const preview = collectDiagnostics();

  return (
    <Screen scroll header={<AppBar onBack={back} title={s.support.title} />}>
      <Text color="ink-muted">{s.support.intro}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={s.support.kind} style={{ gap: tokens.space['space-2'] }}>
        <Text variant="label">{s.support.kind}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
          {kinds.map((option) => {
            const selected = option.value === kind;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => setKind(option.value)}
                style={{
                  minHeight: 48,
                  minWidth: 48,
                  paddingHorizontal: tokens.space['space-4'],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: tokens.space['space-1'],
                  borderRadius: tokens.radius['radius-pill'],
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.brand : colors['line-strong'],
                  backgroundColor: selected ? colors['surface-raised'] : 'transparent',
                }}
              >
                {selected ? <Icon name="check" size={16} color="brand" /> : null}
                <Text variant="label">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: tokens.space['space-1'] }}>
        <Field
          label={s.support.message}
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            setFieldError(undefined);
          }}
          error={fieldError}
          placeholder={s.support.placeholder}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={MAX_LENGTH}
        />
        <Text variant="caption" color="ink-muted" style={{ textAlign: 'right' }}>
          {s.support.counter(message.length, MAX_LENGTH)}
        </Text>
      </View>
      <Card>
        <Switch label={s.support.diagnostics} value={diagnostics} onValueChange={setDiagnostics} disabled={send.isPending} />
        <Text variant="caption" color="ink-muted">
          {s.support.diagnosticsHelper}
        </Text>
        {DIAGNOSTIC_FIELDS.map((field) => (
          <Text key={field} variant="caption" color="ink-muted">
            {`${s.support.diagnosticsFields[field]}: ${preview[field]}`}
          </Text>
        ))}
      </Card>
      {failure ? (
        <Text color="danger" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      <Button title={s.support.send} loading={send.isPending} onPress={submit} />
    </Screen>
  );
}
