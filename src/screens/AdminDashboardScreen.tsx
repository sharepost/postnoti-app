import React from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, Modal, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { TenantManagement } from '../components/admin/TenantManagement';
import { SenderManagement } from '../components/admin/SenderManagement';
import { TenantMailHistory } from '../components/admin/TenantMailHistory';
import { profilesService } from '../services/profilesService';
import { masterSendersService } from '../services/masterSendersService';

export const AdminDashboardScreen = () => {
    const navigation = useNavigation<any>();
    const {
        selectedCompany,
        mailLogs,
        setMailLogs,
        profiles,
        setProfiles,
        masterSenders,
        setMasterSenders,
        logSearchQuery,
        setLogSearchQuery,
        logPageSize,
        setLogPageSize,
        isAdminMenuVisible,
        setIsAdminMenuVisible,
        isTenantMgmtVisible,
        setIsTenantMgmtVisible,
        isSenderMgmtVisible,
        setIsSenderMgmtVisible,
        isHistoryVisible,
        setIsHistoryVisible,
        selectedProfileForHistory,
        setSelectedProfileForHistory,
        runOCR,
        setIsManualSearchVisible,
    } = useAppContent();

    return (
        <View style={appStyles.flexContainer}>
            <AppHeader
                title={`${selectedCompany?.name} 관리`}
                onBack={() => navigation.goBack()}
                onMenu={() => setIsAdminMenuVisible(true)}
            />
            <ScrollView style={appStyles.container} contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
                {/* 1. 퀵 액션 섹션 */}
                <View style={appStyles.premiumQuickActionRow}>
                    <Pressable
                        style={[appStyles.premiumQuickBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }]}
                        onPress={() => {
                            setIsManualSearchVisible(true);
                            navigation.navigate('AdminRegisterMail'); // Move to register screen immediately but manual mode on?
                            // Logic divergence: Original App.tsx had modal within dashboard OR separate screen.
                            // The Register Mail UI was in `renderAdminRegisterMail`. 
                            // Manual Search logic was shared. 
                            // Let's just navigate to RegisterMail, and let user click 'Manual Search' there, or pass param.
                        }}
                    >
                        <Ionicons name="people-outline" size={28} color="#1E293B" style={{ marginBottom: 8 }} />
                        <Text style={[appStyles.premiumQuickBtnTitle, { color: '#1E293B' }]}>수동선택 알림</Text>
                        <Text style={[appStyles.premiumQuickBtnSubtitle, { color: '#64748B' }]}>직접 선택 후 발송</Text>
                    </Pressable>

                    <Pressable
                        style={[appStyles.premiumQuickBtn, { backgroundColor: '#1E293B' }]}
                        onPress={async () => {
                            const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                            if (!result.canceled) {
                                runOCR(result.assets[0].uri);
                                navigation.navigate('AdminRegisterMail');
                            }
                        }}
                    >
                        <Ionicons name="camera-outline" size={28} color="#fff" style={{ marginBottom: 8 }} />
                        <Text style={appStyles.premiumQuickBtnTitle}>자동인식 알림</Text>
                        <Text style={appStyles.premiumQuickBtnSubtitle}>AI가 입주사 찾기</Text>
                    </Pressable>
                </View>

                {/* 2. 최근 발송 내역 섹션 */}
                <View style={[appStyles.premiumInfoCard, { marginTop: 10 }]}>
                    <Text style={[appStyles.premiumInfoLabel, { marginBottom: 16 }]}>최근 발송 내역</Text>
                    <View style={appStyles.premiumSearchBox}>
                        <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ position: 'absolute', left: 14, top: 14, zIndex: 1 }} />
                        <TextInput
                            style={[appStyles.premiumSearchInput, { paddingLeft: 42 }]}
                            placeholder="받는분, 호실, 발신처 검색..."
                            value={logSearchQuery}
                            onChangeText={setLogSearchQuery}
                        />
                    </View>

                    {(() => {
                        const filteredLogs = mailLogs.filter(log => {
                            const query = logSearchQuery.toLowerCase();
                            const name = log.profiles?.name?.toLowerCase() || '';
                            const room = log.profiles?.room_number?.toLowerCase() || '';
                            const sender = log.ocr_content?.toLowerCase() || '';
                            return name.includes(query) || room.includes(query) || sender.includes(query);
                        });

                        if (filteredLogs.length === 0) {
                            return <Text style={appStyles.emptyText}>검색 결과가 없습니다.</Text>;
                        }

                        return (
                            <>
                                {filteredLogs.slice(0, logPageSize).map(log => (
                                    <Pressable
                                        key={log.id}
                                        style={appStyles.logItem}
                                        onPress={() => {
                                            if (log.profiles) {
                                                setSelectedProfileForHistory(log.profiles);
                                                setIsHistoryVisible(true);
                                            }
                                        }}
                                    >
                                        <Image
                                            source={log.image_url ? { uri: log.image_url } : { uri: 'https://via.placeholder.com/50' }}
                                            style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#E2E8F0', marginRight: 12 }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={appStyles.logName}>{log.profiles?.name} ({log.profiles?.room_number})</Text>
                                            <Text style={appStyles.logSender}>
                                                {log.ocr_content ? `To: ${log.ocr_content}` : '발신처 미상'}
                                            </Text>
                                            <Text style={appStyles.logInfo}>{log.mail_type} | {new Date(log.created_at).toLocaleDateString()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 20, color: '#CBD5E1' }}>›</Text>
                                    </Pressable>
                                ))}

                                {filteredLogs.length > logPageSize && (
                                    <Pressable
                                        onPress={() => setLogPageSize(prev => prev + 10)}
                                        style={{ padding: 12, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, marginTop: 10 }}
                                    >
                                        <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 13 }}>
                                            👇 더 보기 ({filteredLogs.length - logPageSize}개 남음)
                                        </Text>
                                    </Pressable>
                                )}
                            </>
                        );
                    })()}
                </View>
            </ScrollView>

            {/* 입주사 관리 모달 */}
            <Modal
                visible={isTenantMgmtVisible}
                animationType="slide"
                onRequestClose={() => setIsTenantMgmtVisible(false)}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <AppHeader title={`${selectedCompany?.name} 입주사 관리`} onBack={() => setIsTenantMgmtVisible(false)} />
                    {selectedCompany && (
                        <TenantManagement
                            companyId={selectedCompany.id}
                            onComplete={async () => {
                                setIsTenantMgmtVisible(false);
                                const p = await profilesService.getProfilesByCompany(selectedCompany.id);
                                setProfiles(p);
                            }}
                            onCancel={() => setIsTenantMgmtVisible(false)}
                        />
                    )}
                </SafeAreaView>
            </Modal>

            {/* 발신처 관리 모달 */}
            <Modal
                visible={isSenderMgmtVisible}
                animationType="slide"
                onRequestClose={() => setIsSenderMgmtVisible(false)}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <AppHeader title="발신처 키워드 관리" onBack={async () => {
                        setIsSenderMgmtVisible(false);
                        const senders = await masterSendersService.getAllSenders();
                        setMasterSenders(senders.map(s => s.name));
                    }} />
                    <SenderManagement onClose={() => setIsSenderMgmtVisible(false)} />
                </SafeAreaView>
            </Modal>

            {/* 상세 이력 모달 */}
            <Modal
                visible={isHistoryVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsHistoryVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
                    <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 20, flex: 1, maxHeight: '80%', overflow: 'hidden' }}>
                        <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700' }}>
                                {selectedProfileForHistory?.name}님의 우편함
                            </Text>
                            <Pressable onPress={() => setIsHistoryVisible(false)} style={{ padding: 5 }}>
                                <Text style={{ fontSize: 16 }}>✕</Text>
                            </Pressable>
                        </View>
                        {selectedProfileForHistory && (
                            <TenantMailHistory
                                profile={selectedProfileForHistory}
                                onClose={() => setIsHistoryVisible(false)}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* 햄버거 메뉴 모달 */}
            <Modal
                visible={isAdminMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsAdminMenuVisible(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
                    onPress={() => setIsAdminMenuVisible(false)}
                >
                    <View style={appStyles.premiumBottomSheet}>
                        <View style={appStyles.bottomSheetHandle} />
                        <View style={appStyles.bottomSheetHeader}>
                            <Text style={appStyles.bottomSheetTitle}>지점 설정 및 관리</Text>
                            <Text style={appStyles.bottomSheetSubtitle}>필요한 관리 기능을 선택해 주세요</Text>
                        </View>
                        <View style={{ gap: 12 }}>
                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsTenantMgmtVisible(true); }}
                                style={appStyles.premiumMenuBtn}
                            >
                                <Ionicons name="business-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={appStyles.menuBtnLabel}>입주사 데이터 관리</Text>
                                    <Text style={appStyles.menuBtnDesc}>입주사 등록, 수정 및 상태 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsSenderMgmtVisible(true); }}
                                style={appStyles.premiumMenuBtn}
                            >
                                <Ionicons name="key-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={appStyles.menuBtnLabel}>발신처 키워드 설정</Text>
                                    <Text style={appStyles.menuBtnDesc}>자동 인식을 위한 필터링 키워드 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            {/* 지점 공유 링크 */}
                            <View style={[appStyles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                                <Ionicons name="link-outline" size={22} color="#4F46E5" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5' }]}>입주자 전용 링크</Text>
                                    <Text style={appStyles.menuBtnDesc} numberOfLines={1}>
                                        {__DEV__ ? 'http://localhost:8082' : 'https://postnoti.vercel.app'}/branch/{selectedCompany?.slug}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={async () => {
                                        const baseUrl = __DEV__ ? 'http://localhost:8082' : 'https://postnoti.vercel.app';
                                        await Clipboard.setStringAsync(`${baseUrl}/branch/${selectedCompany?.slug}`);
                                        // Alert not available here easily? Use RN Alert
                                        // console.log('Copied');
                                    }}
                                    style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>복사</Text>
                                </Pressable>
                            </View>

                            <View style={appStyles.menuSeparator} />

                            <Pressable
                                onPress={() => {
                                    setIsAdminMenuVisible(false);
                                    navigation.navigate('AdminBranchSelect'); // Navigate instead of setMode
                                }}
                                style={appStyles.premiumExitBtn}
                            >
                                <Ionicons name="exit-outline" size={20} color="#E11D48" style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={appStyles.exitBtnLabel}>다른 지점으로 이동</Text>
                                    <Text style={appStyles.exitBtnDesc}>관리 목록으로 돌아가기</Text>
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};
