import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

export const PrimaryButton = ({ label, onPress, style, textStyle, loading, disabled }: { label: string; onPress: () => void; style?: any; textStyle?: any; loading?: boolean; disabled?: boolean }) => (
    <Pressable
        style={[styles.button, style, (loading || disabled) && { opacity: 0.5 }]}
        onPress={onPress}
        disabled={loading || disabled}
    >
        {loading ? (
            <ActivityIndicator color="#fff" />
        ) : (
            <Text style={[styles.buttonText, textStyle]}>{label}</Text>
        )}
    </Pressable>
);

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
