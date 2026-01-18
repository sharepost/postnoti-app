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
    BackHandler
} from 'react-native';
import { masterSendersService, KnownSender } from '../../services/masterSendersService';
import { PrimaryButton } from '../common/PrimaryButton';

interface SenderManagementProps {
    onClose: () => void;
}

export const SenderManagement = ({ onClose }: SenderManagementProps) => {
    const [senders, setSenders] = useState<KnownSender[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSenderName, setNewSenderName] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadSenders();
    }, []);

    const loadSenders = async () => {
        try {
            const data = await masterSendersService.getAllSenders();
            setSenders(data);
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '발신처 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newSenderName.trim()) {
            Alert.alert('알림', '발신처(키워드) 이름을 입력해주세요.');
            return;
        }
        // 중복 체크
        if (senders.some(s => s.name === newSenderName.trim())) {
            Alert.alert('오류', '이미 등록된 발신처입니다.');
            return;
        }

        try {
            setAdding(true);
            await masterSendersService.createSender(newSenderName.trim());
            setNewSenderName('');
            loadSenders();
            Alert.alert('완료', '발신처가 등록되었습니다.');
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '등록에 실패했습니다.');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert('삭제 확인', `'${name}'을(를) 발신처 목록에서 삭제하시겠습니까?`, [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await masterSendersService.deleteSender(id);
                        loadSenders();
                    } catch (error) {
                        console.error(error);
                        Alert.alert('오류', '삭제에 실패했습니다.');
                    }
                }
            }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.addSection}>
                <Text style={styles.description}>
                    이곳에 등록된 단어가 포함된 우편물은 발신처가 자동으로 인식됩니다.
                </Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={newSenderName}
                        onChangeText={setNewSenderName}
                        placeholder="새 키워드 (예: 국민건강보험)"
                    />
                    <Pressable
                        style={[styles.addBtn, (!newSenderName.trim() || adding) && styles.disabledBtn]}
                        onPress={handleAdd}
                        disabled={!newSenderName.trim() || adding}
                    >
                        {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>등록</Text>}
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {senders.map(s => (
                        <View key={s.id} style={styles.item}>
                            <Text style={styles.itemName}>{s.name}</Text>
                            <Pressable onPress={() => handleDelete(s.id, s.name)}>
                                <Text style={styles.deleteText}>삭제</Text>
                            </Pressable>
                        </View>
                    ))}
                    {senders.length === 0 && (
                        <Text style={styles.emptyText}>등록된 발신처가 없습니다.</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    addSection: { marginBottom: 20 },
    description: { color: '#64748B', marginBottom: 15, fontSize: 13 },
    inputRow: { flexDirection: 'row', gap: 10 },
    input: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16 },
    addBtn: { backgroundColor: '#4F46E5', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
    disabledBtn: { backgroundColor: '#94A3B8' },
    addBtnText: { color: '#fff', fontWeight: '700' },
    list: { paddingBottom: 100 },
    item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8 },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
    deleteText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40 }
});
