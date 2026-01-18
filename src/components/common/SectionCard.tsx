import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#111827',
    },
});
