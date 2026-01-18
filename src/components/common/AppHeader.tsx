import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

type Props = {
    title: string;
    onBack?: () => void;
    onMenu?: () => void;
};

export const AppHeader = ({ title, onBack, onMenu }: Props) => {
    return (
        <View style={styles.header}>
            <View style={styles.sideContainer}>
                {onBack && (
                    <Pressable onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </Pressable>
                )}
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.sideContainer}>
                {onMenu && (
                    <Pressable onPress={onMenu} style={styles.menuButton}>
                        <Text style={styles.menuText}>☰</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        height: 80, // Height increased
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'flex-end', // Align items to bottom for better spacing from top
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12, // Space from bottom
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    sideContainer: {
        width: 50,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 22,
        color: '#1E293B',
        fontWeight: '300', // Thinner arrow
    },
    menuButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuText: {
        fontSize: 22,
        color: '#1E293B',
        fontWeight: '300',
    },
    title: {
        fontSize: 17,
        fontWeight: '800', // Slightly bolder for premium feel
        color: '#1E293B',
        flex: 1,
        textAlign: 'center',
        marginBottom: 8, // Adjust vertical position
    },
});
