import React from 'react';
import { View, Text, ScrollView, Pressable, Modal, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../components/common/AppHeader';
import { CompanyManagement } from '../components/admin/CompanyManagement';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';
import { Company } from '../services/companiesService';

export const AdminBranchSelectScreen = () => {
    const navigation = useNavigation<any>();
    const {
        companies,
        loadData,
        handleBranchSelect,
        isAdminMgmtVisible,
        setIsAdminMgmtVisible,
        ocrLoading
    } = useAppContent();

    const onSelectCompany = async (company: Company) => {
        try {
            await handleBranchSelect(company);
            navigation.navigate('AdminDashboard');
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '지점 정보를 불러오는 중 문제가 발생했습니다.');
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace('Landing');
        }
    };

    return (
        <View style={appStyles.flexContainer}>
            <AppHeader title="전체 지점 관리" onBack={handleBack} />
            {ocrLoading && (
                <View style={{ position: 'absolute', zIndex: 99, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={{ marginTop: 10, fontWeight: '700' }}>지점 정보를 불러오고 있습니다...</Text>
                </View>
            )}
            <ScrollView style={appStyles.container} contentContainerStyle={{ paddingBottom: 80, paddingTop: 10 }}>
                <View style={appStyles.adminActionRow}>
                    <Text style={appStyles.adminTitleText}>지점 선택</Text>
                    <Pressable onPress={() => setIsAdminMgmtVisible(true)} style={appStyles.professionalMgmtBtn}>
                        <Text style={appStyles.professionalMgmtBtnText}>지점 추가/설정</Text>
                    </Pressable>
                </View>

                {companies.map(c => (
                    <Pressable
                        key={c.id}
                        onPress={() => onSelectCompany(c)}
                        style={({ pressed }) => ({
                            opacity: pressed ? 0.9 : 1,
                            marginBottom: 16,
                            backgroundColor: '#fff',
                            borderRadius: 20,
                            padding: 24,
                            borderWidth: 1,
                            borderColor: '#F1F5F9',
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.05,
                            shadowRadius: 10,
                        })}
                    >
                        <View style={appStyles.branchCardRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={appStyles.branchNameText}>{c.name}</Text>
                                <Text style={appStyles.branchHintText}>관리 대시보드 바로가기</Text>
                            </View>
                            {/* Link Copy removed for unification */}
                        </View>
                    </Pressable>
                ))}
            </ScrollView>

            {/* 지점 관리 모달 */}
            <Modal visible={isAdminMgmtVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1 }}>
                    <AppHeader title="지점 추가/삭제" onBack={() => { setIsAdminMgmtVisible(false); loadData(); }} />
                    <CompanyManagement
                        onComplete={() => { setIsAdminMgmtVisible(false); loadData(); }}
                        onCancel={() => setIsAdminMgmtVisible(false)}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};
