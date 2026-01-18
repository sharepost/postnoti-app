import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    TextInput,
    Pressable,
    Image,
    Modal,
    BackHandler
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './src/lib/supabase';

// Services
import { companiesService, Company } from './src/services/companiesService';
import { profilesService, Profile } from './src/services/profilesService';
import { recognizeText, MailType, classifyMail, preprocessImage as ocrPreprocess } from './src/services/ocrService';
import { mailService } from './src/services/mailService';
import { masterSendersService } from './src/services/masterSendersService';

// Components
import { PrimaryButton } from './src/components/common/PrimaryButton';
import { AppHeader } from './src/components/common/AppHeader';
import { SectionCard } from './src/components/common/SectionCard';
import { LoginScreen } from './src/components/auth/LoginScreen';
import { TenantDashboard } from './src/components/tenant/TenantDashboard';
import { CompanyManagement } from './src/components/admin/CompanyManagement';
import { TenantManagement } from './src/components/admin/TenantManagement';
import { SenderManagement } from './src/components/admin/SenderManagement';
import { TenantMailHistory } from './src/components/admin/TenantMailHistory';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
    }),
});

type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'tenant_login' | 'tenant_dashboard';

export default function App() {
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitializing, setIsInitializing] = useState(true); // 초기 로딩 상태 추가
    const [expoPushToken, setExpoPushToken] = useState('');

    // Admin States
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false); // 지점 관리 모달
    const [isTenantMgmtVisible, setIsTenantMgmtVisible] = useState(false); // 입주사 관리 모달
    const [isSenderMgmtVisible, setIsSenderMgmtVisible] = useState(false); // 발신처 키워드 관리 모달
    const [isHistoryVisible, setIsHistoryVisible] = useState(false); // 상세 이력 모달
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Profile | null>(null);
    const [isAdminMenuVisible, setIsAdminMenuVisible] = useState(false); // 햄버거 메뉴 모달
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logPageSize, setLogPageSize] = useState(10);

    // Tenant Mode States
    const [selectedTenant, setSelectedTenant] = useState<Profile | null>(null);
    const [tenantMails, setTenantMails] = useState<any[]>([]);

    // Manual Tenant Search States
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    // OCR/Mail States
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState('');
    const [detectedMailType, setDetectedMailType] = useState<MailType>('일반');
    const [detectedSender, setDetectedSender] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extraImages, setExtraImages] = useState<string[]>([]);
    const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);
    const [mailLogs, setMailLogs] = useState<any[]>([]);

    const loadData = async () => {
        const [compList, senders] = await Promise.all([
            companiesService.getCompanies(),
            masterSendersService.getAllSenders()
        ]);
        setCompanies(compList);
        setMasterSenders(senders.map(s => s.name));
    };

    useEffect(() => {
        const init = async () => {
            // 1. 데이터 로드 (지점 목록 등)
            await loadData();

            // 2. 푸시 토큰 등록
            const token = await registerForPushNotificationsAsync();
            if (token) setExpoPushToken(token);

            // 3. 초기 딥링크 확인 루틴 개편
            const handleDeepLink = async (url: string | null) => {
                if (!url) return;
                let slug = '';
                if (url.includes('postnoti://')) {
                    const parts = url.replace('postnoti://', '').split('/');
                    if (parts[0] === 'branch') slug = parts[1];
                } else {
                    try {
                        const urlObj = new URL(url);
                        const pathParts = urlObj.pathname.split('/').filter(p => p);
                        if (pathParts[0] === 'branch') slug = pathParts[1];
                    } catch (e) { }
                }

                if (slug) {
                    const { data } = await supabase.from('companies').select('*').eq('slug', slug).single();
                    if (data) {
                        setBrandingCompany(data);
                        setMode('tenant_login'); // 바로 입주사 로그인 모드로 전환
                    }
                }
            };

            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) {
                await handleDeepLink(initialUrl);
            }

            // 모든 준비가 끝나면 초기화 완료
            setIsInitializing(false);

            // 실시간 링크 리스너 등록
            const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
            return subscription;
        };

        let sub: any;
        init().then(s => sub = s);
        return () => sub?.remove();
    }, []);

    // [뒤로가기 핸들링 추가]
    useEffect(() => {
        const backAction = () => {
            // 1. 모달이 열려있으면 onRequestClose가 처리하도록 양보
            if (isTenantMgmtVisible || isSenderMgmtVisible || isHistoryVisible || isAdminMgmtVisible || isManualSearchVisible) {
                return false;
            }

            // 2. 단계별 뒤로가기 로직 (화면 모드 전환)
            if (mode === 'admin_register_mail') {
                setMode('admin_dashboard');
                return true;
            }
            if (mode === 'admin_dashboard') {
                setMode('admin_branch_select');
                return true;
            }
            if (mode === 'admin_branch_select') {
                setMode('admin_login');
                return true;
            }
            if (mode === 'admin_login') {
                setMode('landing');
                return true;
            }

            // 3. 최상위(Landing)에서는 앱 종료 확인
            if (mode === 'landing') {
                Alert.alert('앱 종료', '앱을 종료하시겠습니까?', [
                    { text: '취소', onPress: () => null, style: 'cancel' },
                    { text: '종료', onPress: () => BackHandler.exitApp() }
                ]);
                return true;
            }

            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => backHandler.remove();
    }, [mode, isTenantMgmtVisible, isAdminMgmtVisible, isSenderMgmtVisible, isHistoryVisible, isManualSearchVisible]);

    const handleBranchSelect = async (company: Company) => {
        setSelectedCompany(company);
        setMode('admin_dashboard');
        const [p, m] = await Promise.all([
            profilesService.getProfilesByCompany(company.id),
            mailService.getMailsByCompany(company.id)
        ]);
        setProfiles(p);
        setMailLogs(m);
    };

    const copyTenantLink = (company: Company) => {
        const link = `postnoti://branch/${company.slug}`;
        Clipboard.setStringAsync(link);
        Alert.alert('복사 완료', `${company.name} 입주사용 링크가 복사되었습니다.\n\n${link}`);
    };



    const findMatch = (text: string, excludeSender?: string) => {
        const lines = text.split('\n').map(l => l.trim().toLowerCase());
        const candidates = profiles.map(p => {
            let score = 0;
            const name = p.name.toLowerCase();
            const compName = p.company_name?.toLowerCase() || '';
            const room = p.room_number?.toLowerCase() || '';

            lines.forEach(line => {
                // [중요] 발신처 정보가 포함된 라인은 입주사 매칭에서 제외하거나 점수를 낮춤
                if (excludeSender && line.includes(excludeSender.toLowerCase())) {
                    return;
                }

                // 1. 회사명 매칭 (가장 높은 가중치)
                if (compName && line.includes(compName)) {
                    score += compName.length > 2 ? 15 : 8; // 회사명 매칭 우대
                }

                // 2. 이름 매칭
                if (line.includes(name)) {
                    score += 5;
                    // 호수와 이름이 한 라인에 있으면 강력한 후보
                    if (room && line.includes(room)) {
                        score += 10;
                    }
                    if (line.includes(`${name} 귀하`) || line.includes(`${name}님`) || line.includes(`${name} 앞`)) {
                        score += 7;
                    }
                }

                // 3. 호수 매칭
                if (room) {
                    const roomPattern = new RegExp(`(^|[^0-9])${room}([^0-9]|$)`);
                    if (roomPattern.test(line)) {
                        score += 5;
                    }
                }
            });

            return { profile: p, score };
        });

        const best = candidates
            .filter(c => c.score > 1) // 최소 점수 문턱
            .sort((a, b) => b.score - a.score)[0];

        return best ? best.profile : null;
    };

    const runOCR = async (uri: string) => {
        try {
            setOcrLoading(true);
            const processed = await ocrPreprocess(uri);
            setSelectedImage(processed.data);

            const result = await recognizeText(uri, masterSenders);
            setRecognizedText(result.text);

            const type = classifyMail(result.text, result.sender);
            setDetectedMailType(type);

            // 발신처 정보를 제외하고 매칭 시도
            const match = findMatch(result.text, result.sender);
            if (match) {
                setMatchedProfile(match);
            } else {
                setMatchedProfile(null);
            }

            // [핵심 변경] 사용자가 등록한 발신처(키워드)에 있는 경우에만 자동 입력
            // result.sender는 ocrService에서 heuristic과 master list 둘 다 체크하지만,
            // 여기서 엄격하게 master senders 목록에 있는 것만 허용하거나,
            // 혹은 ocrService가 이미 마스터 리스트를 우선적으로 체크했으므로
            // result.sender가 master list에 포함되어 있는지 확인하여 아니면 공란 처리

            // result.sender가 masterSenders 배열에 포함되어 있는지 확인
            // (ocrService는 부분일치도 찾아내므로, 완전 일치 여부를 따지거나 포함 여부 확인)
            // 여기서는 '등록된 키워드와 동일하지 않다면 공백'이라는 요청을 '포함되면 인정'으로 해석할지 '완전일치'로 해석할지 결정
            // 편의상 masterSenders 중 하나가 result.sender에 포함되거나 같으면 인정

            const isKnownSender = masterSenders.some(s => result.sender.includes(s) || s.includes(result.sender));

            if (isKnownSender && result.sender) {
                // 매칭된 입주자 정보 제거 (더 깨끗하게)
                let cleanSender = result.sender;
                if (match?.name) cleanSender = cleanSender.replace(match.name, '').trim();
                if (match?.company_name) cleanSender = cleanSender.replace(match.company_name, '').trim();
                setDetectedSender(cleanSender);
            } else {
                // 키워드에 없으면 과감하게 공란 처리 (사용자가 직접 확인 후 입력 유도)
                setDetectedSender('');
            }

        } catch (error) {
            console.error(error);
            Alert.alert('오류', 'OCR 인식 중 문제가 발생했습니다.');
        } finally {
            setOcrLoading(false);
        }
    };

    const handleRegisterMail = async () => {
        if (!selectedCompany) return;
        if (!matchedProfile) {
            Alert.alert('알림', '우편물을 받을 입주사를 선택해주세요.');
            return;
        }

        try {
            setOcrLoading(true);
            await mailService.registerMail(
                selectedCompany.id,
                matchedProfile.id!,
                detectedMailType,
                detectedSender,
                selectedImage || '',
                extraImages
            );

            // 알림 전송
            // 실제 푸시 알림 전송 (Expo Push API)
            if (matchedProfile.push_token) {
                const hasExtra = extraImages.length > 0;
                const message = {
                    to: matchedProfile.push_token,
                    sound: 'default',
                    title: `[${selectedCompany.name}] 우편물 도착 📮`,
                    body: `${detectedSender ? `${detectedSender}에서 보낸 ` : ''}${detectedMailType} 우편물이 도착했습니다.${hasExtra ? ' (상세 사진 포함)' : ''}`,
                    data: { company_id: selectedCompany.id },
                };

                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message),
                });
            }

            Alert.alert('완료', `${matchedProfile.name}님께 알림을 보냈습니다.`);

            // 데이터 갱신 및 화면 이동
            const m = await mailService.getMailsByCompany(selectedCompany.id);
            setMailLogs(m);
            setMode('admin_dashboard');

            // 상태 초기화
            setSelectedImage(null);
            setDetectedSender('');
            setMatchedProfile(null);
            setExtraImages([]);
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '우편물 등록에 실패했습니다.');
        } finally {
            setOcrLoading(false);
        }
    };

    const renderLanding = () => (
        <View style={styles.landingContainer}>
            <View style={styles.heroContent}>
                <View style={styles.premiumLine} />
                <Text style={styles.heroTitle}>POSTNOTI</Text>
                <Text style={styles.heroSubtitle}>공유오피스를 위한 스마트 우편 관리 시스템</Text>
            </View>

            <View style={styles.actionSection}>
                <View style={styles.loginCardDirect}>
                    <Text style={styles.loginDirectTitle}>관리자 로그인</Text>
                    <LoginScreen
                        onLoginSuccess={() => setMode('admin_branch_select')}
                        onBack={() => { }}
                        isEmbedded={true}
                    />
                </View>
            </View>
        </View>
    );

    const renderAdminBranchSelect = () => (
        <View style={styles.flexContainer}>
            <AppHeader title="전체 지점 관리" onBack={() => setMode('landing')} />
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80, paddingTop: 10 }}>
                <View style={styles.adminActionRow}>
                    <Text style={styles.adminTitleText}>지점 선택</Text>
                    <Pressable onPress={() => setIsAdminMgmtVisible(true)} style={styles.professionalMgmtBtn}>
                        <Text style={styles.professionalMgmtBtnText}>지점 추가/설정</Text>
                    </Pressable>
                </View>

                {companies.map(c => (
                    <Pressable
                        key={c.id}
                        onPress={() => handleBranchSelect(c)}
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
                        <View style={styles.branchCardRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.branchNameText}>{c.name}</Text>
                                <Text style={styles.branchHintText}>관리 대시보드 바로가기</Text>
                            </View>
                            <Pressable
                                onPress={() => copyTenantLink(c)}
                                style={styles.minimalLinkBtn}
                            >
                                <Text style={styles.minimalLinkBtnText}>링크 본사</Text>
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

    const renderAdminDashboard = () => (
        <View style={styles.flexContainer}>
            <AppHeader
                title={`${selectedCompany?.name} 관리`}
                onBack={() => setMode('admin_branch_select')}
                onMenu={() => setIsAdminMenuVisible(true)}
            />
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
                {/* 1. 퀵 액션 섹션 (수동선택 왼쪽, 자동인식 오른쪽 / 아이콘 변경) */}
                <View style={styles.premiumQuickActionRow}>
                    <Pressable
                        style={[styles.premiumQuickBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }]}
                        onPress={() => setIsManualSearchVisible(true)}
                    >
                        <Ionicons name="people-outline" size={28} color="#1E293B" style={{ marginBottom: 8 }} />
                        <Text style={[styles.premiumQuickBtnTitle, { color: '#1E293B' }]}>수동선택 알림</Text>
                        <Text style={[styles.premiumQuickBtnSubtitle, { color: '#64748B' }]}>직접 선택 후 발송</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.premiumQuickBtn, { backgroundColor: '#1E293B' }]}
                        onPress={async () => {
                            const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                            if (!result.canceled) {
                                setMode('admin_register_mail');
                                runOCR(result.assets[0].uri);
                            }
                        }}
                    >
                        <Ionicons name="camera-outline" size={28} color="#fff" style={{ marginBottom: 8 }} />
                        <Text style={styles.premiumQuickBtnTitle}>자동인식 알림</Text>
                        <Text style={styles.premiumQuickBtnSubtitle}>AI가 입주사 찾기</Text>
                    </Pressable>
                </View>

                {/* 2. 최근 발송 내역 섹션 (중복 검색란 제거 및 타이틀 변경) */}
                <View style={[styles.premiumInfoCard, { marginTop: 10 }]}>
                    <Text style={[styles.premiumInfoLabel, { marginBottom: 16 }]}>최근 발송 내역</Text>
                    <View style={styles.premiumSearchBox}>
                        <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ position: 'absolute', left: 14, top: 14, zIndex: 1 }} />
                        <TextInput
                            style={[styles.premiumSearchInput, { paddingLeft: 42 }]}
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
                            return <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>;
                        }

                        return (
                            <>
                                {filteredLogs.slice(0, logPageSize).map(log => (
                                    <Pressable
                                        key={log.id}
                                        style={styles.logItem}
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
                                            <Text style={styles.logName}>{log.profiles?.name} ({log.profiles?.room_number})</Text>
                                            <Text style={styles.logSender}>
                                                {log.ocr_content ? `To: ${log.ocr_content}` : '발신처 미상'}
                                            </Text>
                                            <Text style={styles.logInfo}>{log.mail_type} | {new Date(log.created_at).toLocaleDateString()}</Text>
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
        </View>
    );

    const renderAdminRegisterMail = () => (
        <View style={styles.flexContainer}>
            <AppHeader title="우편물 등록" onBack={() => setMode('admin_dashboard')} />
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                <SectionCard title="우편물 촬영">
                    {selectedImage ? (
                        <View>
                            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                            <Pressable style={styles.retakeBtn} onPress={async () => {
                                const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                if (!result.canceled) runOCR(result.assets[0].uri);
                            }}>
                                <Text style={styles.retakeBtnText}>♻️ 다시 촬영</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <PrimaryButton
                            label="📷 우편물 사진 촬영"
                            onPress={async () => {
                                const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                if (!result.canceled) runOCR(result.assets[0].uri);
                            }}
                        />
                    )}
                    {ocrLoading && <ActivityIndicator style={{ marginTop: 20 }} color="#4F46E5" />}
                </SectionCard>

                {selectedImage && !ocrLoading && (
                    <>
                        <SectionCard title="인식 결과 및 대상 설정">
                            <View style={styles.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={styles.label}>받는 분 (입주사)</Text>
                                    <Pressable
                                        onPress={() => setIsManualSearchVisible(true)}
                                        style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                    >
                                        <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>🔍 수동 검색</Text>
                                    </Pressable>
                                </View>
                                <View style={styles.profileSelector}>
                                    {matchedProfile ? (
                                        <View style={[styles.matchedBox, !matchedProfile.is_active && { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                                            <View>
                                                <Text style={[styles.matchedText, !matchedProfile.is_active && { color: '#B91C1C' }]}>
                                                    {!matchedProfile.is_active ? '🚫 ' : '✅ '}
                                                    {matchedProfile.name} ({matchedProfile.room_number})
                                                </Text>
                                                {!matchedProfile.is_active && (
                                                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                                                        ⚠️ 퇴거된 입주사입니다
                                                    </Text>
                                                )}
                                            </View>
                                            <Pressable onPress={() => setMatchedProfile(null)}>
                                                <Text style={styles.changeText}>변경</Text>
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileList}>
                                            {profiles.map(p => (
                                                <Pressable
                                                    key={p.id}
                                                    style={[styles.profileChip, !p.is_active && { opacity: 0.5, backgroundColor: '#F3F4F6' }]}
                                                    onPress={() => setMatchedProfile(p)}
                                                >
                                                    <Text style={[styles.profileChipText, !p.is_active && { color: '#9CA3AF' }]}>
                                                        {p.name} {!p.is_active && '(퇴거)'}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>발신처 (보낸이)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={detectedSender}
                                    onChangeText={setDetectedSender}
                                    placeholder="보낸이를 확인해주세요"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>우편 종류</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeList}>
                                    {['일반', '등기/중요', '세금/국세', '고지서/요금'].map(t => (
                                        <Pressable
                                            key={t}
                                            style={[styles.typeChip, detectedMailType === t && styles.typeChipActive]}
                                            onPress={() => setDetectedMailType(t as any)}
                                        >
                                            <Text style={[styles.typeChipText, detectedMailType === t && styles.typeChipTextActive]}>{t}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        </SectionCard>

                        {matchedProfile?.is_premium && (
                            <SectionCard title="✨ 프리미엄 서비스: 상세 촬영">
                                <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 15 }}>
                                    입주사가 개봉/촬영 요청 대상입니다. 추가 페이지를 촬영하세요.
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {extraImages.map((uri, idx) => (
                                        <View key={idx} style={{ position: 'relative' }}>
                                            <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }} />
                                            <Pressable
                                                onPress={() => setExtraImages(prev => prev.filter((_, i) => i !== idx))}
                                                style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✕</Text>
                                            </Pressable>
                                        </View>
                                    ))}
                                    <Pressable
                                        onPress={async () => {
                                            const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                            if (!result.canceled) {
                                                // 추가 촬영 이미지도 압축 적용
                                                const processed = await ocrPreprocess(result.assets[0].uri);
                                                setExtraImages(prev => [...prev, processed.uri]);
                                            }
                                        }}
                                        style={{ width: 80, height: 80, borderRadius: 8, borderStyle: 'dotted', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}
                                    >
                                        <Text style={{ color: '#94A3B8', fontSize: 24 }}>+</Text>
                                        <Text style={{ color: '#94A3B8', fontSize: 10 }}>페이지 추가</Text>
                                    </Pressable>
                                </View>
                            </SectionCard>
                        )}

                        <View style={{ padding: 20, marginBottom: 40 }}>
                            <PrimaryButton
                                label={
                                    !matchedProfile
                                        ? '입주사를 선택해주세요'
                                        : !matchedProfile.is_active
                                            ? '퇴거된 입주사입니다 (발송 불가)'
                                            : `${matchedProfile.name}님께 알림 보내기`
                                }
                                onPress={handleRegisterMail}
                                disabled={!matchedProfile || !matchedProfile.is_active}
                            />
                        </View>
                    </>
                )}

                {/* 수동 입주사 검색 모달 */}
                <Modal
                    visible={isManualSearchVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => {
                        setIsManualSearchVisible(false);
                        setManualSearchQuery('');
                    }}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
                            <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, fontWeight: '700' }}>입주사 검색</Text>
                                <Pressable onPress={() => {
                                    setIsManualSearchVisible(false);
                                    setManualSearchQuery('');
                                }} style={{ padding: 5 }}>
                                    <Text style={{ fontSize: 16 }}>✕</Text>
                                </Pressable>
                            </View>

                            <View style={{ padding: 15 }}>
                                <TextInput
                                    style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 15 }}
                                    placeholder="입주사명, 호실 검색..."
                                    value={manualSearchQuery}
                                    onChangeText={setManualSearchQuery}
                                    autoFocus
                                />
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {profiles
                                    .filter(p => {
                                        const query = manualSearchQuery.toLowerCase();
                                        return (
                                            p.name.toLowerCase().includes(query) ||
                                            (p.company_name?.toLowerCase() || '').includes(query) ||
                                            (p.room_number?.toLowerCase() || '').includes(query)
                                        );
                                    })
                                    .map(p => (
                                        <Pressable
                                            key={p.id}
                                            style={{
                                                padding: 15,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#F1F5F9',
                                                backgroundColor: !p.is_active ? '#FEF2F2' : '#fff'
                                            }}
                                            onPress={() => {
                                                setMatchedProfile(p);
                                                setIsManualSearchVisible(false);
                                                setManualSearchQuery('');
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View>
                                                    <Text style={{ fontSize: 16, fontWeight: '700', color: !p.is_active ? '#B91C1C' : '#1E293B' }}>
                                                        {p.name}
                                                    </Text>
                                                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                                                        {p.company_name || '회사명 없음'} | {p.room_number || '호실 미기재'}
                                                    </Text>
                                                </View>
                                                {!p.is_active && (
                                                    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>퇴거</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </View>
    );

    if (isInitializing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 15, color: '#64748B', fontSize: 13, fontWeight: '600' }}>지점 정보를 인식하고 있습니다...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.appContainer}>
                {mode === 'landing' && renderLanding()}
                {mode === 'admin_login' && <LoginScreen onLoginSuccess={() => setMode('admin_branch_select')} onBack={() => setMode('landing')} />}
                {mode === 'admin_branch_select' && renderAdminBranchSelect()}
                {mode === 'admin_dashboard' && renderAdminDashboard()}
                {mode === 'admin_register_mail' && renderAdminRegisterMail()}
                {mode === 'tenant_login' && brandingCompany && (
                    <TenantDashboard
                        companyId={brandingCompany.id}
                        companyName={brandingCompany.name}
                        pushToken={expoPushToken}
                        onBack={() => setMode('landing')}
                    />
                )}
            </View>

            {/* 햄버거 메뉴 (지점 설정 관리) - 글로벌 레이어 */}
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
                    <View style={styles.premiumBottomSheet}>
                        {/* 핸들 바 */}
                        <View style={styles.bottomSheetHandle} />

                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>지점 설정 및 관리</Text>
                            <Text style={styles.bottomSheetSubtitle}>필요한 관리 기능을 선택해 주세요</Text>
                        </View>

                        <View style={{ gap: 12 }}>
                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsTenantMgmtVisible(true); }}
                                style={styles.premiumMenuBtn}
                            >
                                <Ionicons name="business-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={styles.menuBtnTextGroup}>
                                    <Text style={styles.menuBtnLabel}>입주사 데이터 관리</Text>
                                    <Text style={styles.menuBtnDesc}>입주사 등록, 수정 및 상태 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsSenderMgmtVisible(true); }}
                                style={styles.premiumMenuBtn}
                            >
                                <Ionicons name="key-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={styles.menuBtnTextGroup}>
                                    <Text style={styles.menuBtnLabel}>발신처 키워드 설정</Text>
                                    <Text style={styles.menuBtnDesc}>자동 인식을 위한 필터링 키워드 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            {/* 지점 공유 링크 섹션 - 햄버거 메뉴 내부에 통합 */}
                            <View style={[styles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                                <Ionicons name="link-outline" size={22} color="#4F46E5" style={{ marginRight: 16 }} />
                                <View style={styles.menuBtnTextGroup}>
                                    <Text style={[styles.menuBtnLabel, { color: '#4F46E5' }]}>입주자 전용 링크</Text>
                                    <Text style={styles.menuBtnDesc} numberOfLines={1}>
                                        {__DEV__ ? 'http://localhost:8082' : 'https://postnoti.vercel.app'}/branch/{selectedCompany?.slug}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={async () => {
                                        const baseUrl = __DEV__ ? 'http://localhost:8082' : 'https://postnoti.vercel.app';
                                        await Clipboard.setStringAsync(`${baseUrl}/branch/${selectedCompany?.slug}`);
                                        Alert.alert('복사 완료', '클립보드에 복사되었습니다.');
                                    }}
                                    style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>복사</Text>
                                </Pressable>
                            </View>

                            <View style={styles.menuSeparator} />

                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setMode('admin_branch_select'); }}
                                style={styles.premiumExitBtn}
                            >
                                <Ionicons name="exit-outline" size={20} color="#E11D48" style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.exitBtnLabel}>다른 지점으로 이동</Text>
                                    <Text style={styles.exitBtnDesc}>관리 목록으로 돌아가기</Text>
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return '';
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') return '';
    try {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: 'a78cf50e-37ca-4d89-86f5-87cf1fdff7f2' })).data;
        return token;
    } catch (e) {
        return '';
    }
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    appContainer: { flex: 1 },
    flexContainer: { flex: 1 },
    container: { flex: 1, padding: 20 },
    landingContainer: { flex: 1, justifyContent: 'center', padding: 40 },
    heroContent: { alignItems: 'center', marginBottom: 60 },
    brandBadge: { backgroundColor: '#EEF2FF', color: '#4F46E5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '600', marginBottom: 12, overflow: 'hidden' },
    heroTitle: { fontSize: 32, fontWeight: '800', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
    heroSubtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 24 },
    buttonGroup: { gap: 15 },
    introBox: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    introText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
    adminEntry: { marginTop: 30, alignItems: 'center' },
    adminEntryText: { color: '#94A3B8', fontSize: 14, textDecorationLine: 'underline' },
    adminActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    adminTitle: { fontSize: 24, fontWeight: '700', color: '#1E293B' },
    mgmtBtn: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8 },
    mgmtBtnText: { color: '#475569', fontWeight: '600' },
    branchCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    branchName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    branchSlug: { fontSize: 13, color: '#64748B' },
    branchHint: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    linkBtn: { backgroundColor: '#E0F2FE', padding: 10, borderRadius: 8 },
    linkBtnText: { color: '#0369A1', fontSize: 13, fontWeight: '700' },
    logItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' },
    logName: { fontWeight: '700', color: '#1E293B' },
    logSender: { fontSize: 13, color: '#64748B', lineHeight: 18 },
    logInfo: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginVertical: 20 },
    previewImage: { width: '100%', height: 260, borderRadius: 12, marginTop: 15 },
    retakeBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 },
    retakeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1E293B' },
    profileSelector: { marginTop: 4 },
    matchedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0' },
    matchedText: { color: '#166534', fontWeight: '700', fontSize: 14 },
    changeText: { color: '#4F46E5', fontSize: 12, fontWeight: '600' },
    profileList: { marginTop: 4 },
    profileChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    profileChipText: { color: '#475569', fontWeight: '600' },
    typeList: { marginTop: 4 },
    typeChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    typeChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    typeChipText: { color: '#475569', fontWeight: '600' },
    typeChipTextActive: { color: '#fff' },

    // New Dashboard Styles
    quickActionContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    quickActionButton: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
    iconCircle: { width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    quickActionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
    quickActionDesc: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
    shareLinkCompact: { backgroundColor: '#EEF2FF', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#C7D2FE' },

    // Premium Landing Styles
    premiumLine: { width: 40, height: 3, backgroundColor: '#1E293B', marginBottom: 24, borderRadius: 2 },
    actionSection: { width: '100%', marginTop: 20 },
    tenantHint: { textAlign: 'center', fontSize: 13, color: '#94A3B8', lineHeight: 20 },
    loginCardDirect: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
    },
    loginDirectTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 24, textAlign: 'center' },

    // Admin Branch Select Premium Styles
    adminTitleText: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    professionalMgmtBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    professionalMgmtBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
    branchNameText: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    branchHintText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
    minimalLinkBtn: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    minimalLinkBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },

    // Admin Dashboard Premium Styles
    premiumQuickActionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    premiumQuickBtn: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
    premiumQuickBtnIcon: { fontSize: 28, marginBottom: 8 },
    premiumQuickBtnTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
    premiumQuickBtnSubtitle: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    premiumInfoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
    premiumInfoLabel: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    premiumSmallBtn: { backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    premiumSmallBtnText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
    premiumLinkBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    premiumLinkText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
    premiumSearchBox: { marginBottom: 16 },
    premiumSearchInput: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, fontSize: 14, borderWidth: 1, borderColor: '#F1F5F9', color: '#1E293B' },

    // Bottom Sheet Premium Styles
    premiumBottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20
    },
    bottomSheetHandle: { width: 36, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
    bottomSheetHeader: { marginBottom: 24 },
    bottomSheetTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    bottomSheetSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
    premiumMenuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    menuBtnTextGroup: { flex: 1 },
    menuBtnLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    menuBtnDesc: { fontSize: 12, color: '#64748B' },
    menuBtnArrow: { fontSize: 20, color: '#CBD5E1', fontWeight: '300' },
    menuSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
    premiumExitBtn: { padding: 20, borderRadius: 20, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FFE4E6' },
    exitBtnLabel: { fontSize: 15, fontWeight: '700', color: '#E11D48', marginBottom: 2 },
    exitBtnDesc: { fontSize: 12, color: '#FB7185' },
});
