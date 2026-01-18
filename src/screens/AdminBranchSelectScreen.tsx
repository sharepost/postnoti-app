import React from 'react';
import { View, Text, ScrollView, Pressable, Modal, SafeAreaView, Alert } from 'react-native';
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
        copyTenantLink
    } = useAppContent();

    const onSelectCompany = async (company: Company) => {
        await handleBranchSelect(company);
        navigation.navigate('AdminDashboard');
    };

    return (
        <View style={appStyles.flexContainer}>
            <AppHeader title="전체 지점 관리" onBack={() => navigation.goBack()} />
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
                            <Pressable
                                onPress={() => copyTenantLink(c)}
                                style={appStyles.minimalLinkBtn}
                            >
                                <Text style={appStyles.minimalLinkBtnText}>링크 본사</Text>
                            </Pressable>
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
