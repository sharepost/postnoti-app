import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';

export const LandingScreen = () => {
    const navigation = useNavigation<any>();
    const { setMode } = useAppContent();
    // Note: setMode is kept for functionality, but we primarily use navigation now

    return (
        <View style={appStyles.landingContainer}>
            <View style={appStyles.heroContent}>
                <View style={appStyles.premiumLine} />
                <Text style={appStyles.heroTitle}>POSTNOTI</Text>
                <Text style={appStyles.heroSubtitle}>공유오피스를 위한 스마트 우편 관리 시스템</Text>
            </View>

            <View style={appStyles.actionSection}>
                <View style={appStyles.loginCardDirect}>
                    <Text style={appStyles.loginDirectTitle}>관리자 로그인</Text>
                    <LoginScreen
                        onLoginSuccess={() => {
                            // Sync both state logic (if needed) and new navigation
                            setMode('admin_branch_select');
                            navigation.replace('AdminBranchSelect');
                        }}
                        onBack={() => { }}
                        isEmbedded={true}
                    />
                </View>
            </View>
        </View>
    );
};
