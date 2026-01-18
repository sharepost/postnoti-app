import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Alert,
    Pressable,
    ActivityIndicator,
    Switch,
    BackHandler
} from 'react-native';
import { profilesService, Profile } from '../../services/profilesService';
import { PrimaryButton } from '../common/PrimaryButton';

interface TenantManagementProps {
    companyId: string;
    onComplete: () => void;
    onCancel: () => void;
}

export const TenantManagement = ({ companyId, onComplete, onCancel }: TenantManagementProps) => {
    const [tenants, setTenants] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'name' | 'room'>('name');
    const [isEditing, setIsEditing] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Partial<Profile>>({
        company_id: companyId,
        company_name: '',
        name: '',
        room_number: '',
        phone: '',
        is_active: true,
        role: 'tenant'
    });

    useEffect(() => {
        loadTenants();
    }, []);

    useEffect(() => {
        const backAction = () => {
            if (isEditing) {
                setIsEditing(false);
                return true;
            }
            // 수정 모드가 아니면 false를 반환하여 
            // Modal의 onRequestClose나 상위 핸들러가 처리하게 함
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [isEditing]); // isEditing이 바뀔 때마다 핸들러 갱신

    const loadTenants = async () => {
        try {
            setLoading(true);
            const data = await profilesService.getProfilesByCompany(companyId);
            setTenants(data);
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '입주자 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingTenant.name || !editingTenant.phone) {
            Alert.alert('알림', '이름과 전화번호는 필수입니다.');
            return;
        }

        try {
            setLoading(true);
            if (editingTenant.id) {
                await profilesService.updateProfile(editingTenant.id, editingTenant);
            } else {
                await profilesService.createProfile(editingTenant as Profile);
            }
            Alert.alert('성공', '입주사 정보가 저장되었습니다.');
            loadTenants();
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '저장에 실패했습니다. (DB 컬럼 확인 필요)');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('삭제 확인', '정말 이 입주사를 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    await profilesService.deleteProfile(id);
                    loadTenants();
                }
            }
        ]);
    };

    const filteredTenants = tenants
        .filter(t => {
            const query = searchQuery.toLowerCase();
            return (
                t.name.toLowerCase().includes(query) ||
                (t.company_name?.toLowerCase() || '').includes(query) ||
                (t.room_number?.toLowerCase() || '').includes(query) ||
                t.phone.includes(query)
            );
        })
        .sort((a, b) => {
            if (sortOrder === 'name') {
                return a.name.localeCompare(b.name);
            } else {
                const roomA = a.room_number || '';
                const roomB = b.room_number || '';
                return roomA.localeCompare(roomB, undefined, { numeric: true });
            }
        });

    const activeCount = tenants.filter(t => t.is_active).length;

    if (isEditing) {
        return (
            <View style={styles.editForm}>
                <Text style={styles.formTitle}>{editingTenant.id ? '입주사 정보 수정' : '신규 입주사 등록'}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>회사명</Text>
                    <TextInput
                        style={styles.input}
                        value={editingTenant.company_name}
                        onChangeText={t => setEditingTenant({ ...editingTenant, company_name: t })}
                        placeholder="회사명을 입력하세요"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>이름 (담당자)</Text>
                    <TextInput
                        style={styles.input}
                        value={editingTenant.name}
                        onChangeText={t => setEditingTenant({ ...editingTenant, name: t })}
                        placeholder="이름을 입력하세요"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>호실</Text>
                    <TextInput
                        style={styles.input}
                        value={editingTenant.room_number}
                        onChangeText={t => setEditingTenant({ ...editingTenant, room_number: t })}
                        placeholder="예: 301호"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>전화번호</Text>
                    <TextInput
                        style={styles.input}
                        value={editingTenant.phone}
                        onChangeText={t => setEditingTenant({ ...editingTenant, phone: t })}
                        placeholder="01012345678"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={[styles.inputGroup, styles.switchGroup]}>
                    <Text style={styles.label}>입주 상태 (입주중)</Text>
                    <Switch
                        value={editingTenant.is_active}
                        onValueChange={v => setEditingTenant({ ...editingTenant, is_active: v })}
                    />
                </View>

                <View style={[styles.inputGroup, styles.switchGroup]}>
                    <View>
                        <Text style={styles.label}>프리미엄 서비스</Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>우편 배송물 개봉 및 상세 촬영 대상</Text>
                    </View>
                    <Switch
                        value={editingTenant.is_premium}
                        onValueChange={v => setEditingTenant({ ...editingTenant, is_premium: v })}
                        trackColor={{ true: '#4F46E5', false: '#CBD5E1' }}
                    />
                </View>

                <View style={styles.formButtons}>
                    <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                        <Text style={styles.cancelBtnText}>취소</Text>
                    </Pressable>
                    <PrimaryButton label="저장하기" onPress={handleSave} loading={loading} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>입주사 관리</Text>
                    <Text style={styles.countText}>입주 {activeCount} / 전체 {tenants.length}</Text>
                </View>
                <Pressable
                    onPress={() => {
                        setEditingTenant({ company_id: companyId, is_active: true, role: 'tenant' });
                        setIsEditing(true);
                    }}
                    style={styles.addBtn}
                >
                    <Text style={styles.addBtnText}>+ 입주사 등록</Text>
                </Pressable>
            </View>

            <View style={styles.searchBarContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="이름, 회사명, 호정, 전화번호 검색"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <View style={styles.sortContainer}>
                <Pressable
                    onPress={() => setSortOrder('name')}
                    style={[styles.sortBtn, sortOrder === 'name' && styles.sortBtnActive]}
                >
                    <Text style={[styles.sortBtnText, sortOrder === 'name' && styles.sortBtnTextActive]}>이름순</Text>
                </Pressable>
                <Pressable
                    onPress={() => setSortOrder('room')}
                    style={[styles.sortBtn, sortOrder === 'room' && styles.sortBtnActive]}
                >
                    <Text style={[styles.sortBtnText, sortOrder === 'room' && styles.sortBtnTextActive]}>호정순</Text>
                </Pressable>
            </View>

            {loading && tenants.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {filteredTenants.map(t => (
                        <View key={t.id} style={styles.tenantCard}>
                            <View style={styles.tenantInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.tenantCompanyName}>{t.company_name || '(회사명 없음)'}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: t.is_active ? '#F0FDF4' : '#FEF2F2' }]}>
                                        <Text style={[styles.statusBadgeText, { color: t.is_active ? '#166534' : '#991B1B' }]}>
                                            {t.is_active ? '입주중' : '퇴거'}
                                        </Text>
                                    </View>
                                    {t.is_premium && (
                                        <View style={[styles.statusBadge, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1 }]}>
                                            <Text style={[styles.statusBadgeText, { color: '#4338CA' }]}>Premium</Text>
                                        </View>
                                    )}
                                    {t.pwa_installed && (
                                        <View style={[styles.statusBadge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 }]}>
                                            <Text style={[styles.statusBadgeText, { color: '#0369A1' }]}>📱 앱설치</Text>
                                        </View>
                                    )}
                                    {t.web_push_token && (
                                        <View style={[styles.statusBadge, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1 }]}>
                                            <Text style={[styles.statusBadgeText, { color: '#6D28D9' }]}>🔔 알림ON</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.tenantName}>{t.name} | {t.room_number || '호수미기재'}</Text>
                                <Text style={styles.tenantPhone}>{t.phone}</Text>
                            </View>
                            <View style={styles.cardActions}>
                                <Pressable onPress={() => { setEditingTenant(t); setIsEditing(true); }} style={styles.editBtn}>
                                    <Text style={styles.editBtnText}>수정</Text>
                                </Pressable>
                                <Pressable onPress={() => handleDelete(t.id!)} style={styles.deleteBtn}>
                                    <Text style={styles.deleteBtnText}>삭제</Text>
                                </Pressable>
                            </View>
                        </View>
                    ))}
                    {filteredTenants.length === 0 && (
                        <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    countText: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
    addBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    searchBarContainer: { marginBottom: 10 },
    searchInput: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 15, color: '#1E293B' },
    sortContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    sortBtn: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    sortBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    sortBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
    sortBtnTextActive: { color: '#fff' },
    tenantCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    tenantInfo: { flex: 1 },
    tenantCompanyName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginRight: 8 },
    tenantName: { fontSize: 14, color: '#475569', marginTop: 4 },
    tenantPhone: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    cardActions: { justifyContent: 'space-around', alignItems: 'flex-end', marginLeft: 10 },
    editBtn: { padding: 4 },
    editBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
    deleteBtn: { padding: 4 },
    deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
    editForm: { padding: 20 },
    formTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 25 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1E293B' },
    switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    formButtons: { flexDirection: 'row', gap: 10, marginTop: 20, justifyContent: 'flex-end' },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
    cancelBtnText: { color: '#64748B', fontWeight: '600' },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40 }
});
