// Composants d'interface partagés : toute l'app passe par eux pour rester cohérente.
import React from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type, space, radius } from '../styles/globalStyles';

export const Icon = ({ name, size = 20, color, style }) => {
  const t = useTheme();
  return <Feather name={name} size={size} color={color || t.text} style={style} />;
};

export const Txt = ({ variant = 'body', color, muted, faint, style, ...props }) => {
  const t = useTheme();
  const c = color || (faint ? t.textFaint : muted ? t.textMuted : t.text);
  return <Text style={[type[variant], { color: c }, style]} {...props} />;
};

export const Button = ({
  title, icon, onPress, variant = 'primary', size = 'md', disabled, loading, style, color,
}) => {
  const t = useTheme();
  const palette = {
    primary: { bg: color || t.accent, fg: t.onAccent },
    secondary: { bg: t.surfaceAlt, fg: color || t.text },
    soft: { bg: t.accentSoft, fg: color || t.accent },
    ghost: { bg: 'transparent', fg: color || t.accent },
    danger: { bg: t.dangerSoft, fg: t.danger },
  }[variant];
  const h = size === 'sm' ? 36 : size === 'lg' ? 54 : 46;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, height: h, paddingHorizontal: size === 'sm' ? 12 : 18, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon ? <Feather name={icon} size={size === 'sm' ? 15 : 17} color={palette.fg} style={title ? { marginRight: 8 } : null} /> : null}
          {title ? <Text style={[size === 'sm' ? type.caption : type.bodyStrong, { color: palette.fg, fontWeight: '600' }]}>{title}</Text> : null}
        </>
      )}
    </Pressable>
  );
};

export const IconButton = ({ name, onPress, size = 20, color, bg, style, diameter = 40, disabled }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        { width: diameter, height: diameter, borderRadius: diameter / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg || 'transparent', opacity: pressed ? 0.6 : disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Feather name={name} size={size} color={color || t.text} />
    </Pressable>
  );
};

export const Card = ({ children, style, onPress, padded = true }) => {
  const t = useTheme();
  const base = [styles.card, { backgroundColor: t.surface }, padded && { padding: space.lg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
};

export const Divider = ({ inset = 0, style }) => {
  const t = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: inset }, style]} />;
};

export const ProgressBar = ({ value, color, height = 4, style }) => {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: t.surfaceAlt, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height, backgroundColor: color || t.accent }} />
    </View>
  );
};

export const Check = ({ checked, onPress, color, size = 24 }) => {
  const t = useTheme();
  const c = color || t.accent;
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: 2,
        borderColor: checked ? c : t.textFaint, backgroundColor: checked ? c : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked ? <Feather name="check" size={size * 0.6} color={t.onAccent} /> : null}
      </View>
    </Pressable>
  );
};

export const Segmented = ({ options, value, onChange, style }) => {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surfaceAlt }, style]}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.segment, active && { backgroundColor: t.surface }]}>
            <Text style={[type.caption, { fontWeight: '600', color: active ? t.text : t.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Chip = ({ label, selected, onPress, icon, style }) => {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: selected ? t.accent : t.surfaceAlt }, style]}>
      {icon ? <Feather name={icon} size={13} color={selected ? t.onAccent : t.textMuted} style={{ marginRight: 5 }} /> : null}
      <Text style={[type.caption, { color: selected ? t.onAccent : t.text, fontWeight: selected ? '600' : '400' }]}>{label}</Text>
    </Pressable>
  );
};

export const SectionHeader = ({ title, right, style }) => (
  <View style={[styles.sectionHeader, style]}>
    <Txt variant="overline" muted>{title}</Txt>
    {right || null}
  </View>
);

// Ligne de liste (réglages, options de formulaire)
export const ListRow = ({ icon, label, sublabel, value, onPress, right, chevron, destructive }) => {
  const t = useTheme();
  const content = (
    <View style={styles.listRow}>
      {icon ? <Feather name={icon} size={18} color={destructive ? t.danger : t.textMuted} style={{ marginRight: space.md }} /> : null}
      <View style={{ flex: 1 }}>
        <Txt color={destructive ? t.danger : undefined}>{label}</Txt>
        {sublabel ? <Txt variant="small" muted>{sublabel}</Txt> : null}
      </View>
      {value != null ? <Txt muted style={{ marginLeft: space.sm }}>{value}</Txt> : null}
      {right || null}
      {chevron ? <Feather name="chevron-right" size={18} color={t.textFaint} style={{ marginLeft: 4 }} /> : null}
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>{content}</Pressable>;
};

export const Stepper = ({ value, onMinus, onPlus }) => {
  const t = useTheme();
  return (
    <View style={styles.stepper}>
      <IconButton name="minus" size={16} diameter={32} bg={t.surfaceAlt} onPress={onMinus} />
      <Txt variant="bodyStrong" style={{ minWidth: 64, textAlign: 'center' }}>{value}</Txt>
      <IconButton name="plus" size={16} diameter={32} bg={t.surfaceAlt} onPress={onPlus} />
    </View>
  );
};

export const EmptyState = ({ icon, title, text, children }) => {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: t.surfaceAlt }]}>
          <Feather name={icon} size={22} color={t.textMuted} />
        </View>
      ) : null}
      {title ? <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt> : null}
      {text ? <Txt muted style={{ textAlign: 'center', marginTop: 4 }}>{text}</Txt> : null}
      {children}
    </View>
  );
};

// Feuille qui monte du bas de l'écran
export const Sheet = ({ visible, onClose, title, children, footer, scroll = true }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* Une modale a sa propre fenêtre : on y réapplique le style de la barre d'état */}
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + space.xl, maxHeight: '92%' }]}>
          <View style={[styles.handle, { backgroundColor: t.border }]} />
          {title ? (
            <View style={styles.sheetHeader}>
              <Txt variant="heading" style={{ flex: 1 }}>{title}</Txt>
              <IconButton name="x" onPress={onClose} color={t.textMuted} diameter={34} bg={t.surfaceAlt} size={18} />
            </View>
          ) : null}
          <Body {...(scroll ? { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: space.lg } } : {})} style={scroll ? { flexGrow: 0 } : null}>
            {children}
          </Body>
          {footer ? <View style={{ paddingTop: space.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Menu d'actions contextuel
export const ActionSheet = ({ visible, onClose, title, subtitle, actions = [] }) => {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      {title ? <Txt variant="heading" numberOfLines={2}>{title}</Txt> : null}
      {subtitle ? <Txt variant="caption" muted style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      <View style={{ marginTop: space.md }}>
        {actions.filter(Boolean).map((a, i) => (
          <Pressable
            key={a.label}
            onPress={() => { onClose(); setTimeout(() => a.onPress && a.onPress(), 250); }}
            style={({ pressed }) => [styles.action, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }, pressed && { opacity: 0.6 }]}
          >
            <Feather name={a.icon || 'circle'} size={18} color={a.destructive ? t.danger : t.textMuted} style={{ marginRight: space.md }} />
            <Txt color={a.destructive ? t.danger : undefined}>{a.label}</Txt>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  button: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, minHeight: 50 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.sm },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
});
