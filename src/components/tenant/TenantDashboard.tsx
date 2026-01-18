import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    ActivityIndicator, TextInput, Alert, Pressable, Modal,
    SafeAreaView, TouchableWithoutFeedback, BackHandler, ScrollView,
    Dimensions, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../lib/supabase';
import { mailService } from '../../services/mailService';
import { profilesService, Profile } from '../../services/profilesService';
import { PrimaryButton } from '../common/PrimaryButton';
import { messaging, getToken, VAPID_KEY } from '../../lib/firebase';
import { Platform } from 'react-native';

type Props = {
    companyId: string;
    companyName: string;
    pushToken?: string;
    webPushToken?: string;
    onBack: () => void;
};

export const TenantDashboard = ({ companyId, companyName, pushToken, webPushToken, onBack }: Props) => {
    const [name, setName] = useState('');
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [mails, setMails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [identifying, setIdentifying] = useState(false);

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    const [selectedMailImage, setSelectedMailImage] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all'); // 필터 상태
    const [sound, setSound] = useState<Audio.Sound>();
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // 설정 로드
    useEffect(() => {
        AsyncStorage.getItem('soundEnabled').then(val => {
            if (val !== null) setSoundEnabled(val === 'true');
        });
    }, []);

    // 설정 저장
    const toggleSound = async (val: boolean) => {
        setSoundEnabled(val);
        await AsyncStorage.setItem('soundEnabled', String(val));
    };

    // 효과음 로드
    const playNotificationSound = async () => {
        if (!soundEnabled) return; // 소리 끄면 재생 안 함
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../../../assets/notification_sound.mp3') // 에셋이 없으면 기본 시스템 소리로 대체하거나 에러 처리 필요
            );
            setSound(sound);
            await sound.playAsync();
        } catch (error) {
            // 파일이 없을 경우 대비해 콘솔만 찍고 넘어감 (실제로는 에셋 추가 필요)
            console.log('Error playing sound', error);
        }
    };

    // 언마운트 시 사운드 해제
    useEffect(() => {
        return sound
            ? () => { sound.unloadAsync(); }
            : undefined;
    }, [sound]);

    // 실시간 구독 (새 우편물 알림)
    useEffect(() => {
        if (!myProfile?.id) return;

        const channel = supabase
            .channel('public:mails')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mails',
                    filter: `profile_id=eq.${myProfile.id}`,
                },
                (payload) => {
                    // 새 우편물이 오면 리스트 갱신 및 알림음
                    playNotificationSound();
                    setMails(prev => [payload.new, ...prev]);
                    Alert.alert('📬 새 우편물 도착!', '방금 새로운 우편물이 도착했습니다.');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myProfile?.id]);


    // 자동 로그인 확인
    useEffect(() => {
        const checkAutoLogin = async () => {
            try {
                const storedName = await AsyncStorage.getItem(`tenant_name_${companyId}`);
                const storedPhone = await AsyncStorage.getItem(`tenant_phone_${companyId}`);

                if (storedName && storedPhone) {
                    setName(storedName);
                    setPhoneSuffix(storedPhone);
                    // 자동 로그인 시도
                    handleIdentify(storedName, storedPhone);
                }
            } catch (e) {
                console.log('Auto login failed', e);
            }
        };
        checkAutoLogin();
    }, [companyId]);

    // PWA Installation Handling
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        const installedHandler = async () => {
            console.log('PWA was installed');
            setShowInstallBanner(false);
            if (myProfile?.id) {
                await profilesService.updateProfile(myProfile.id, { pwa_installed: true });
            }
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, [myProfile?.id]);

    // Web Push Sync Effect
    useEffect(() => {
        if (myProfile?.id && webPushToken) {
            profilesService.updateProfile(myProfile.id, { web_push_token: webPushToken });
        }
    }, [myProfile?.id, webPushToken]);

    const handleInstallPrompt = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
    };

    // 뒤로가기 핸들러
    useEffect(() => {
        const backAction = () => {
            if (selectedMailImage) {
                setSelectedMailImage(null);
                return true;
            }
            if (myProfile) {
                // 로그아웃 대신 앱 종료 방지? 아니면 그냥 뒤로가기?
                // 여기서 뒤로가면 랜딩으로 가는데, 자동로그인이 되어있으면 다시 바로 로그인될 수 있음.
                // 일단 로그아웃 확인을 받거나 해야하지만, 여기선 프로필 해제만.
                Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
                    { text: '취소', style: 'cancel' },
                    {
                        text: '로그아웃',
                        onPress: async () => {
                            setMyProfile(null);
                            await AsyncStorage.removeItem(`tenant_name_${companyId}`);
                            await AsyncStorage.removeItem(`tenant_phone_${companyId}`);
                        }
                    }
                ]);
                return true;
            }
            onBack();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [selectedMailImage, myProfile, onBack, companyId]);

    // 본인 확인
    const handleIdentify = async (inputName?: string, inputPhone?: string) => {
        const targetName = inputName || name;
        const targetPhone = inputPhone || phoneSuffix;

        if (!targetName.trim()) {
            Alert.alert('알림', '입주사 명칭을 입력해주세요.');
            return;
        }
        if (targetPhone.length !== 4) {
            Alert.alert('알림', '전화번호 뒷자리 4자리를 정확히 입력해주세요.');
            return;
        }

        setIdentifying(true);
        try {
            const profile = await profilesService.getTenantProfile(companyId, targetName.trim(), targetPhone);
            if (!profile) {
                if (!inputName) Alert.alert('조회 실패', '입주사 정보가 일치하지 않습니다.');
                return;
            }
            if (profile.id && pushToken) {
                await profilesService.updateProfile(profile.id, { push_token: pushToken });
            }
            if (profile.id && webPushToken) {
                await profilesService.updateProfile(profile.id, { web_push_token: webPushToken });
            }

            // 로그인 성공 시 저장
            await AsyncStorage.setItem(`tenant_name_${companyId}`, targetName.trim());
            await AsyncStorage.setItem(`tenant_phone_${companyId}`, targetPhone);

            setMyProfile(profile);
            loadMails(profile.id!);
        } catch (err) {
            Alert.alert('오류', '조회 중 문제가 발생했습니다.');
        } finally {
            setIdentifying(false);
        }
    };

    const loadMails = async (profileId: string) => {
        setLoading(true);
        try {
            const data = await mailService.getMailsByProfile(profileId);
            setMails(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderMailItem = ({ item }: { item: any }) => (
        <Pressable
            style={styles.mailItem}
            onPress={() => {
                if (item.image_url) {
                    setSelectedMailImage(item.image_url);
                    if (!item.read_at) {
                        mailService.markAsRead(item.id);
                        setMails(prev => prev.map(m => m.id === item.id ? { ...m, read_at: new Date().toISOString() } : m));
                    }
                }
            }}
        >
            <View style={styles.mailInfo}>
                <View style={styles.mailHeader}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Text style={styles.mailType}>{item.mail_type}</Text>
                        {item.read_at ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                                <Text style={[styles.statusText, { color: '#15803D' }]}>읽음</Text>
                            </View>
                        ) : (
                            <View style={[styles.statusBadge, { backgroundColor: '#FEF2F2' }]}>
                                <Text style={[styles.statusText, { color: '#DC2626' }]}>안읽음</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.mailDate}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <Text style={styles.mailContent} numberOfLines={2}>
                    {item.ocr_content || '내용 없음'}
                </Text>
                {item.image_url && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[styles.statusText, { color: '#1E40AF' }]}>📷 사진 보기</Text>
                        </View>
                        {item.extra_images && item.extra_images.length > 0 && (
                            <View style={[styles.statusBadge, { backgroundColor: '#EEF2FF' }]}>
                                <Text style={[styles.statusText, { color: '#4338CA' }]}>📄 +{item.extra_images.length}페이지</Text>
                            </View>
                        )}
                    </View>
                )}
                {/* 프리미엄 상세 이미지 미리보기 */}
                {item.extra_images && item.extra_images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {item.extra_images.map((img: string, idx: number) => (
                                <Pressable
                                    key={idx}
                                    onPress={() => {
                                        setSelectedMailImage(img);
                                        if (!item.read_at) {
                                            mailService.markAsRead(item.id);
                                            setMails(prev => prev.map(m => m.id === item.id ? { ...m, read_at: new Date().toISOString() } : m));
                                        }
                                    }}
                                >
                                    <Image source={{ uri: img }} style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: '#F1F5F9' }} />
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>
            {item.image_url ? (
                <Image
                    source={{ uri: item.image_url }}
                    style={styles.mailImage}
                    resizeMode="cover"
                />
            ) : null}
        </Pressable>
    );

    if (!myProfile) {
        if (identifying && !name) {
            // 자동 로그인 시도 중일 때 로딩 표시 (name이 세팅되기 전 등)
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>자동 로그인 중...</Text>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.identifyBox}>
                    <View style={styles.premiumLoginCard}>
                        <View style={styles.loginHeader}>
                            <Text style={styles.welcomeSubtitle}>내 우편물 확인하기</Text>
                            <Text style={styles.welcomeTitle}>{companyName}</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>입주사명 (상호명)</Text>
                                <TextInput
                                    style={styles.premiumInput}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="입주사 이름을 입력하세요"
                                    placeholderTextColor="#94A3B8"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>전화번호 뒷 4자리</Text>
                                <TextInput
                                    style={styles.premiumInput}
                                    value={phoneSuffix}
                                    onChangeText={setPhoneSuffix}
                                    placeholder="0000"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry={true}
                                />
                            </View>

                            <PrimaryButton
                                label="우편물 조회 시작"
                                onPress={() => handleIdentify()}
                                loading={identifying}
                                style={styles.premiumButton}
                                textStyle={{ fontSize: 16, fontWeight: '700' }}
                            />
                        </View>

                        <View style={styles.secureBadge}>
                            <Text style={{ fontSize: 13 }}>🔒</Text>
                            <Text style={styles.secureText}>안전하게 보호되고 있습니다</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    const requestNotificationPermission = async () => {
        if (Platform.OS !== 'web') return;

        // 브라우저 권한 객체 체크
        if (typeof Notification === 'undefined') {
            window.alert('이 브라우저/기기는 알림 기능을 지원하지 않습니다.\n아이폰이라면 반드시 "홈 화면에 추가"를 먼저 해주세요!');
            return;
        }

        if (!messaging) {
            window.alert('알림 엔진 준비 중... 인터넷 연결을 확인하고 다시 시도해주세요.');
            return;
        }

        try {
            console.log("Requesting permission...");
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                window.alert('권한 허용됨! 기기 정보를 등록합니다...');
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });

                if (token && myProfile?.id) {
                    await profilesService.updateProfile(myProfile.id, { web_push_token: token });
                    window.alert('✅ 알림 설정 완료!\n이제 우편물이 오면 스마트폰으로 알려드립니다.');
                    // 강제 새로고침으로 배너를 지우고 상태를 확정합니다.
                    window.location.reload();
                } else {
                    window.alert('신분증(토큰)을 가져오지 못했습니다. 잠시 후 새로고침 해주세요.');
                }
            } else if (permission === 'denied') {
                window.alert('알림 권한이 차단되어 있습니다.\n설정에서 알림을 허용으로 바꿔주세요.');
            }
        } catch (error: any) {
            console.error('Error:', error);
            window.alert('설정 중 오류: ' + (error?.message || '알 수 없는 에러'));
        }
    };


    // 필터링 및 정렬 로직
    const filteredMails = mails.filter(mail => {
        if (filter === 'unread') return !mail.read_at;
        return true;
    });

    const unreadCount = mails.filter(m => !m.read_at).length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>{myProfile.name}님</Text>
                        {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>+{unreadCount}</Text>
                            </View>
                        )}
                        <Pressable onPress={() => setIsSettingsVisible(true)} style={{ marginLeft: 4 }}>
                            <Text style={{ fontSize: 18 }}>⚙️</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.subtitle}>{companyName} 우편함</Text>
                </View>
                <Pressable onPress={() => setMyProfile(null)}>
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>로그아웃</Text>
                </Pressable>
            </View>

            {/* 알림 권한 유도 배너 (토큰이 없을 때만 표시) */}
            {Platform.OS === 'web' && !myProfile.web_push_token && (
                <View style={[styles.installBanner, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.installBannerTitle, { color: '#6D28D9' }]}>🔔 알림이 꺼져 있습니다</Text>
                        <Text style={[styles.installBannerDesc, { color: '#7C3AED' }]}>알림을 켜고 우편물 소식을 실시간으로 받으세요.</Text>
                    </View>
                    <Pressable
                        style={[styles.installButton, { backgroundColor: '#7C3AED' }]}
                        onPress={requestNotificationPermission}
                    >
                        <Text style={styles.installButtonText}>알림 켜기</Text>
                    </Pressable>
                </View>
            )}

            {/* PWA 설치 유도 배너 */}
            {showInstallBanner && (
                <View style={styles.installBanner}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.installBannerTitle}>📱 홈 화면에 앱 설치</Text>
                        <Text style={styles.installBannerDesc}>바탕화면에 앱을 만들어 더 편하게 사용하세요.</Text>
                    </View>
                    <Pressable style={styles.installButton} onPress={handleInstallPrompt}>
                        <Text style={styles.installButtonText}>설치하기</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowInstallBanner(false)} style={{ marginLeft: 10 }}>
                        <Text style={{ fontSize: 16, color: '#94A3B8' }}>✕</Text>
                    </Pressable>
                </View>
            )}

            {/* 탭 필터 */}
            {/* 알림 설정 배너 - 기기마다 알림 권한이 다를 수 있으므로 브라우저 권한을 직접 체크 */}
            {(Platform.OS === 'web' && typeof Notification !== 'undefined' && (Notification.permission === 'default' || Notification.permission === 'denied')) && (
                <View style={{
                    margin: 16,
                    padding: 20,
                    backgroundColor: '#4F46E5', // 눈에 띄는 진한 보라색
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 8,
                }}>
                    <View style={{ flex: 1, marginRight: 15 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 }}>
                            📢 푸시 알림 허용
                        </Text>
                        <Text style={{ fontSize: 13, color: '#E0E7FF', lineHeight: 18 }}>
                            실시간으로 우편물 도착 소식을 받으시려면 허용 버튼을 눌러주세요.
                        </Text>
                    </View>
                    <Pressable
                        onPress={async () => {
                            console.log("Push allow button clicked");
                            if (window.confirm('실시간 푸시 알림을 허용하시겠습니까?')) {
                                await requestNotificationPermission();
                            }
                        }}
                        style={({ pressed }) => ({
                            backgroundColor: pressed ? '#E0E7FF' : '#FFFFFF',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12,
                        })}
                    >
                        <Text style={{ color: '#4F46E5', fontWeight: '800', fontSize: 14 }}>허용하기</Text>
                    </Pressable>
                </View>
            )}

            <View style={styles.tabContainer}>
                <Pressable
                    style={[styles.tabButton, filter === 'all' && styles.activeTab]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.tabText, filter === 'all' && styles.activeTabText]}>전체 보기</Text>
                </Pressable>
                <Pressable
                    style={[styles.tabButton, filter === 'unread' && styles.activeTab]}
                    onPress={() => setFilter('unread')}
                >
                    <Text style={[styles.tabText, filter === 'unread' && styles.activeTabText]}>
                        안읽음 {unreadCount > 0 ? `(${unreadCount})` : ''}
                    </Text>
                </Pressable>
            </View>

            <FlatList
                data={filteredMails}
                keyExtractor={(item) => item.id}
                renderItem={renderMailItem}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Text style={styles.emptyText}>
                            {filter === 'unread' ? '모두 확인하셨네요! 🎉' : '받은 우편물이 없습니다.'}
                        </Text>
                    </View>
                }
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            />

            {/* 설정 모달 */}
            <Modal
                visible={isSettingsVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsSettingsVisible(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setIsSettingsVisible(false)}
                >
                    <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: '#fff', width: '80%', padding: 24, borderRadius: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20, color: '#1E293B' }}>알림 설정</Text>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <View>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>앱 실행 중 알림음</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>새 우편물 도착 시 효과음 재생</Text>
                                </View>
                                <Switch
                                    value={soundEnabled}
                                    onValueChange={toggleSound}
                                    trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                                    thumbColor={soundEnabled ? '#4F46E5' : '#f4f3f4'}
                                />
                            </View>

                            <Pressable
                                onPress={() => setIsSettingsVisible(false)}
                                style={{ marginTop: 20, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#475569', fontWeight: '700' }}>닫기</Text>
                            </Pressable>
                        </View>
                    </TouchableWithoutFeedback>
                </Pressable>
            </Modal>

            {/* 이미지 확대 모달 */}
            <Modal
                visible={!!selectedMailImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedMailImage(null)}
            >
                <View style={styles.modalContainer}>
                    <Pressable style={styles.closeButton} onPress={() => setSelectedMailImage(null)}>
                        <Text style={styles.closeButtonText}>✕ 닫기</Text>
                    </Pressable>
                    <ScrollView
                        maximumZoomScale={5}
                        minimumZoomScale={1}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.zoomWrapper}
                    >
                        <Image
                            source={{ uri: selectedMailImage || '' }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                    </ScrollView>
                    <View style={styles.zoomFooter}>
                        <Text style={styles.zoomFooterText}>💡 손가락으로 벌려 확대할 수 있습니다</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
    identifyBox: { padding: 24, flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' },
    premiumLoginCard: { backgroundColor: '#fff', padding: 32, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
    loginHeader: { marginBottom: 32, alignItems: 'center' },
    welcomeTitle: { fontSize: 26, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
    welcomeSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    formGroup: { gap: 20 },
    inputContainer: { gap: 8 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#475467', marginLeft: 4 },
    premiumInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 18, fontSize: 16, color: '#1E293B' },
    premiumButton: { borderRadius: 16, height: 56, marginTop: 8, backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    secureBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6, opacity: 0.6 },
    secureText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    header: { padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
    unreadBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    // 탭 스타일
    tabContainer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#F8FAFC' },
    tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#E2E8F0' },
    activeTab: { backgroundColor: '#1E293B' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    activeTabText: { color: '#fff' },

    mailItem: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    mailInfo: { flex: 1 },
    mailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    mailType: { fontSize: 14, fontWeight: '700', color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
    mailDate: { fontSize: 12, color: '#94A3B8' },
    mailContent: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 12, fontWeight: '700' },
    mailImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F1F5F9' },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 15 },

    // 확대 모달 스타일
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },

    // PWA 배너 스타일
    installBanner: {
        backgroundColor: '#EEF2FF',
        margin: 16,
        marginBottom: 0,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    installBannerTitle: { fontSize: 15, fontWeight: '800', color: '#4338CA', marginBottom: 2 },
    installBannerDesc: { fontSize: 12, color: '#6366F1' },
    installButton: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    installButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
