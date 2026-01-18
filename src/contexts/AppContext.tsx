import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, BackHandler } from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';

// Services
import { companiesService, Company } from '../services/companiesService';
import { profilesService, Profile } from '../services/profilesService';
import { mailService } from '../services/mailService';
import { masterSendersService } from '../services/masterSendersService';
import { recognizeText, MailType, classifyMail, preprocessImage as ocrPreprocess } from '../services/ocrService';

// Utils
import { registerForPushNotificationsAsync } from '../utils/notificationHelper';
import { messaging, getToken, VAPID_KEY } from '../lib/firebase';
import { Platform } from 'react-native';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'tenant_login' | 'tenant_dashboard';

interface AppContextType {
    // Global State
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    isInitializing: boolean;
    expoPushToken: string;
    webPushToken: string;
    brandingCompany: Company | null;
    setBrandingCompany: (comp: Company | null) => void;

    // Admin Data
    companies: Company[];
    selectedCompany: Company | null;
    setSelectedCompany: (comp: Company | null) => void;
    profiles: Profile[]; // Tenants inside selected company
    setProfiles: (profiles: Profile[]) => void;
    mailLogs: any[];
    setMailLogs: (logs: any[]) => void;
    masterSenders: string[];
    setMasterSenders: (senders: string[]) => void;

    // UI Visibility States (Modals)
    isAdminMgmtVisible: boolean;
    setIsAdminMgmtVisible: (v: boolean) => void;
    isTenantMgmtVisible: boolean;
    setIsTenantMgmtVisible: (v: boolean) => void;
    isSenderMgmtVisible: boolean;
    setIsSenderMgmtVisible: (v: boolean) => void;
    isHistoryVisible: boolean;
    setIsHistoryVisible: (v: boolean) => void;
    isAdminMenuVisible: boolean;
    setIsAdminMenuVisible: (v: boolean) => void;
    isManualSearchVisible: boolean;
    setIsManualSearchVisible: (v: boolean) => void;

    // Other UI States
    selectedProfileForHistory: Profile | null;
    setSelectedProfileForHistory: (p: Profile | null) => void;
    logSearchQuery: string;
    setLogSearchQuery: (q: string) => void;
    logPageSize: number;
    setLogPageSize: (s: number) => void;
    manualSearchQuery: string;
    setManualSearchQuery: (q: string) => void;

    // OCR & Mail Registration State
    selectedImage: string | null;
    setSelectedImage: (uri: string | null) => void;
    ocrLoading: boolean;
    recognizedText: string;
    detectedMailType: MailType;
    setDetectedMailType: (t: MailType) => void;
    detectedSender: string;
    setDetectedSender: (s: string) => void;
    matchedProfile: Profile | null;
    setMatchedProfile: (p: Profile | null) => void;
    extraImages: string[];
    setExtraImages: (imgs: string[]) => void;

    // Actions
    loadData: () => Promise<void>;
    handleBranchSelect: (company: Company) => Promise<void>;
    runOCR: (uri: string) => Promise<void>;
    handleRegisterMail: () => Promise<void>;
    copyTenantLink: (company: Company) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    // --- States ---
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState('');
    const [webPushToken, setWebPushToken] = useState('');

    // Admin Data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);
    const [mailLogs, setMailLogs] = useState<any[]>([]);

    // UI Visibility
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false);
    const [isTenantMgmtVisible, setIsTenantMgmtVisible] = useState(false);
    const [isSenderMgmtVisible, setIsSenderMgmtVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isAdminMenuVisible, setIsAdminMenuVisible] = useState(false);
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);

    // Search & Filters
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Profile | null>(null);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logPageSize, setLogPageSize] = useState(10);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    // OCR & Mail Flow
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState('');
    const [detectedMailType, setDetectedMailType] = useState<MailType>('일반');
    const [detectedSender, setDetectedSender] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extraImages, setExtraImages] = useState<string[]>([]);
    const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

    // --- Effects ---

    const loadData = async () => {
        try {
            const [compList, senders] = await Promise.all([
                companiesService.getCompanies(),
                masterSendersService.getAllSenders()
            ]);
            setCompanies(compList);
            setMasterSenders(senders.map(s => s.name));
        } catch (e) {
            console.error("Failed to load initial data", e);
        }
    };

    useEffect(() => {
        const init = async () => {
            // 1. Load Data
            await loadData();

            // 2. Register Push
            if (Platform.OS === 'web') {
                if (messaging && typeof Notification !== 'undefined') {
                    try {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                            if (token) setWebPushToken(token);
                        }
                    } catch (e) {
                        console.error("Web push registration failed", e);
                    }
                }
            } else {
                const token = await registerForPushNotificationsAsync();
                if (token) setExpoPushToken(token);
            }

            // 3. Deep Link Handling
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
                        setMode('tenant_login');
                    }
                }
            };

            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) await handleDeepLink(initialUrl);

            setIsInitializing(false);

            const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
            return () => subscription.remove();
        };

        let sub: any;
        init();
    }, []);

    // Back Handler Logic (Moved from App.tsx)
    useEffect(() => {
        const backAction = () => {
            // 1. Modals
            if (isTenantMgmtVisible || isSenderMgmtVisible || isHistoryVisible || isAdminMgmtVisible || isManualSearchVisible) {
                return false; // Let modal props handle it or close manually via state elsewhere if needed. 
                // NOTE: In App.tsx, returning false meant "default behavior" or "propagate". 
                // But for modals, usually we want to intercept.
                // The original code returned false, relying on specific modal onRequestClose logic?
                // Actually, if we want to CLOSE modal on back press, we should do it here if the modal is full screen.
                // For now, let's keep original logic philosophy: if specific modal Logic handles it, we return false?
                // Wait, original usage in App.tsx:
                /*
                  if (isTenantMgmtVisible ... ) return false; 
                */
                // This implies the Modal's own onRequestClose handles the back press (because valid Modal component handles back button on Android).
                // specific Modal component 'visible' prop manages it.
                return false;
            }

            // 2. Mode Navigation
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

            // 3. Landing -> Exit
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


    // --- Actions ---

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
        const webLink = `https://postnoti-app.vercel.app/branch/${company.slug}`;
        const appLink = `postnoti://branch/${company.slug}`;

        // 웹 링크를 기본으로 클립보드에 복사
        Clipboard.setStringAsync(webLink);
        Alert.alert(
            '복사 완료',
            `${company.name} 입주사용 배포 링크가 복사되었습니다.\n\n웹: ${webLink}\n앱: ${appLink}`
        );
    };

    // OCR Logic Helper
    const findMatch = (text: string, excludeSender?: string) => {
        const lines = text.split('\n').map(l => l.trim().toLowerCase());
        const candidates = profiles.map(p => {
            let score = 0;
            const name = p.name.toLowerCase();
            const compName = p.company_name?.toLowerCase() || '';
            const room = p.room_number?.toLowerCase() || '';

            lines.forEach(line => {
                if (excludeSender && line.includes(excludeSender.toLowerCase())) return;
                if (compName && line.includes(compName)) score += compName.length > 2 ? 15 : 8;
                if (line.includes(name)) {
                    score += 5;
                    if (room && line.includes(room)) score += 10;
                    if (line.includes(`${name} 귀하`) || line.includes(`${name}님`) || line.includes(`${name} 앞`)) score += 7;
                }
                if (room) {
                    const roomPattern = new RegExp(`(^|[^0-9])${room}([^0-9]|$)`);
                    if (roomPattern.test(line)) score += 5;
                }
            });
            return { profile: p, score };
        });

        const best = candidates.filter(c => c.score > 1).sort((a, b) => b.score - a.score)[0];
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

            const match = findMatch(result.text, result.sender);
            setMatchedProfile(match || null);

            const isKnownSender = masterSenders.some(s => result.sender.includes(s) || s.includes(result.sender));
            if (isKnownSender && result.sender) {
                let cleanSender = result.sender;
                if (match?.name) cleanSender = cleanSender.replace(match.name, '').trim();
                if (match?.company_name) cleanSender = cleanSender.replace(match.company_name, '').trim();
                setDetectedSender(cleanSender);
            } else {
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

            // Send Push
            if (matchedProfile.push_token) {
                const hasExtra = extraImages.length > 0;
                const message = {
                    to: matchedProfile.push_token,
                    sound: 'default',
                    title: `[${selectedCompany.name}] 우편물 도착 📮`,
                    body: `${detectedSender ? `${detectedSender}에서 보낸 ` : ''}${detectedMailType} 우편물이 도착했습니다.${hasExtra ? ' (상세 사진 포함)' : ''}`,
                    data: { company_id: selectedCompany.id },
                };

                // Note: Ideally move this to Edge Function
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

            // --- Web Push (Vercel Serverless Function) ---
            if (matchedProfile.web_push_token) {
                try {
                    const pushPayload = {
                        token: matchedProfile.web_push_token,
                        title: `[${selectedCompany.name}] 우편물 도착 📮`,
                        body: `${detectedSender ? `${detectedSender}에서 보낸 ` : ''}${detectedMailType} 우편물이 도착했습니다.`,
                        data: {
                            company_id: selectedCompany.id,
                            click_action: `https://postnoti-app.vercel.app/branch/${selectedCompany.slug}`
                        }
                    };

                    // 우리가 방금 만든 Vercel API 서버를 호출합니다.
                    await fetch('/api/send-push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(pushPayload)
                    });
                    console.log("Web push requested via API for:", matchedProfile.name);
                } catch (e) {
                    console.error("Web push API call failed", e);
                }
            }

            Alert.alert('완료', `${matchedProfile.name}님께 알림을 보냈습니다.`);

            const m = await mailService.getMailsByCompany(selectedCompany.id);
            setMailLogs(m);
            setMode('admin_dashboard');

            // Reset
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

    return (
        <AppContext.Provider
            value={{
                mode, setMode,
                isInitializing,
                expoPushToken,
                webPushToken,
                brandingCompany, setBrandingCompany,
                companies, selectedCompany, setSelectedCompany,
                profiles, setProfiles,
                mailLogs, setMailLogs,
                masterSenders, setMasterSenders,
                isAdminMgmtVisible, setIsAdminMgmtVisible,
                isTenantMgmtVisible, setIsTenantMgmtVisible,
                isSenderMgmtVisible, setIsSenderMgmtVisible,
                isHistoryVisible, setIsHistoryVisible,
                isAdminMenuVisible, setIsAdminMenuVisible,
                isManualSearchVisible, setIsManualSearchVisible,
                selectedProfileForHistory, setSelectedProfileForHistory,
                logSearchQuery, setLogSearchQuery,
                logPageSize, setLogPageSize,
                manualSearchQuery, setManualSearchQuery,
                selectedImage, setSelectedImage,
                ocrLoading,
                recognizedText,
                detectedMailType, setDetectedMailType,
                detectedSender, setDetectedSender,
                matchedProfile, setMatchedProfile,
                extraImages, setExtraImages,
                loadData,
                handleBranchSelect,
                runOCR,
                handleRegisterMail,
                copyTenantLink
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContent = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContent must be used within an AppProvider');
    }
    return context;
};
