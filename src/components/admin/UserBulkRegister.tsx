import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { profilesService, Profile } from '../../services/profilesService';
import { PrimaryButton } from '../common/PrimaryButton';
import { SectionCard } from '../common/SectionCard';

export const UserBulkRegister = ({ companyId, onComplete }: { companyId: string; onComplete: () => void }) => {
    const [bulkText, setBulkText] = useState('홍길동, 01012345678, 710-1호, 주식회사 대성');
    const [loading, setLoading] = useState(false);

    const handleProcess = async () => {
        if (!bulkText.trim()) return;

        setLoading(true);
        try {
            // Input format: Name, Phone, RoomNumber, CompanyName (one per line)
            const lines = bulkText.split('\n').filter(line => line.trim());
            const profiles: Profile[] = lines.map(line => {
                const [name, phone, room, company_name] = line.split(',').map(s => s.trim());
                return {
                    company_id: companyId,
                    name: name || 'Unknown',
                    phone: phone || '',
                    room_number: room || '',
                    company_name: company_name || '',
                    role: 'tenant',
                    is_active: false
                };
            });
            // ... (rest same)

            await profilesService.bulkRegister(profiles);
            Alert.alert('성공', `${profiles.length}명의 입주민이 등록되었습니다.`);
            setBulkText('');
            onComplete();
        } catch (error: any) {
            Alert.alert('오류', error.message || '등록 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SectionCard title="입주민 일괄 등록">
            <Text style={styles.helperText}>
                포맷: 이름, 전화번호, 호수, 회사명 (한 줄에 한 명씩){'\n'}
                예: 홍길동, 01012345678, 710-1호, 주식회사 대성
            </Text>
            <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={10}
                placeholder="정보를 입력하거나 붙여넣으세요..."
                value={bulkText}
                onChangeText={setBulkText}
            />
            <PrimaryButton
                label={loading ? "등록 중..." : "일괄 등록 실행"}
                onPress={handleProcess}
                style={loading ? styles.disabledButton : null}
            />
        </SectionCard>
    );
};

const styles = StyleSheet.create({
    textArea: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 12,
        minHeight: 150,
        textAlignVertical: 'top',
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    helperText: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 8,
        lineHeight: 18,
    },
    disabledButton: {
        backgroundColor: '#94a3b8',
    }
});
