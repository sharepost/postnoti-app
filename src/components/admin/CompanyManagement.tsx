import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase'; // Direct service use for simplicity here
import { PrimaryButton } from '../common/PrimaryButton';
import { SectionCard } from '../common/SectionCard';

type Props = {
    initialData?: { id: string, name: string, slug?: string } | null;
    onComplete: () => void;
    onCancel: () => void;
};

export const CompanyManagement = ({ initialData, onComplete, onCancel }: Props) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
        } else {
            setName('');
        }
    }, [initialData]);

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('알림', '지점명을 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            if (initialData) {
                // 수정 모드
                const { error } = await supabase
                    .from('companies')
                    .update({ name: name.trim() })
                    .eq('id', initialData.id);

                if (error) throw error;
                Alert.alert('성공', '지점 정보가 수정되었습니다.');
            } else {
                // 생성 모드
                // slug는 name 기반으로 자동 생성 (중복 방지 위해 random string 추가)
                const slugCandidate = Math.random().toString(36).substring(2, 10);

                const { error } = await supabase
                    .from('companies')
                    .insert({
                        name: name.trim(),
                        slug: slugCandidate
                    });

                if (error) throw error;
                Alert.alert('성공', '새로운 지점이 등록되었습니다.');
            }
            onComplete();
        } catch (error: any) {
            console.error(error);
            Alert.alert('오류', error.message || '작업을 처리할 수 없습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            {/* 헤더 공간 */}
            <View style={{ height: 60, justifyContent: 'center', marginBottom: 20 }}>
                <PrimaryButton
                    label="< 뒤로가기"
                    onPress={onCancel}
                    style={{ backgroundColor: 'transparent', alignSelf: 'flex-start', paddingLeft: 0 }}
                    textStyle={{ color: '#64748B' }}
                />
            </View>

            <SectionCard title={initialData ? "지점 정보 수정" : "새 지점 등록"}>
                <Text style={styles.helperText}>
                    관리할 공유오피스의 지점 이름을 입력해주세요.{'\n'}
                    (예: 강남점, 판교점, 홍대입구점 등)
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="지점명 입력 (예: 강남점)"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                />

                <PrimaryButton
                    label={loading ? "처리 중..." : (initialData ? "수정 완료" : "등록하기")}
                    onPress={handleSubmit}
                    style={{ marginTop: 10 }}
                />
            </SectionCard>
        </View>
    );
};

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    helperText: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16,
        lineHeight: 20,
    }
});
