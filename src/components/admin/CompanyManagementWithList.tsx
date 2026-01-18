import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Company } from '../../services/companiesService';
import { CompanyManagement } from './CompanyManagement';
import { AppHeader } from '../common/AppHeader';

type Props = {
    companies: Company[];
    onComplete: () => void;
    onCancel: () => void;
};

export const CompanyManagementWithList = ({ companies, onComplete, onCancel }: Props) => {
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    if (selectedCompany || isCreating) {
        return (
            <CompanyManagement
                initialData={selectedCompany}
                onComplete={() => {
                    setSelectedCompany(null);
                    setIsCreating(false);
                    onComplete();
                }}
                onCancel={() => {
                    setSelectedCompany(null);
                    setIsCreating(false);
                }}
            />
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <AppHeader title="지점 추가/삭제" onBack={onCancel} />
            <ScrollView style={styles.container}>
                <Text style={styles.sectionTitle}>기존 지점 목록</Text>
                <Text style={styles.helperText}>수정 또는 삭제할 지점을 선택하세요</Text>

                {companies.map((company) => (
                    <Pressable
                        key={company.id}
                        style={styles.companyCard}
                        onPress={() => setSelectedCompany(company)}
                    >
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{company.name}</Text>
                            {company.address && (
                                <Text style={styles.companyAddress}>{company.address}</Text>
                            )}
                        </View>
                        <Text style={styles.editButton}>수정 ›</Text>
                    </Pressable>
                ))}

                {companies.length === 0 && (
                    <Text style={styles.emptyText}>등록된 지점이 없습니다</Text>
                )}

                <Pressable
                    style={styles.addButton}
                    onPress={() => setIsCreating(true)}
                >
                    <Text style={styles.addButtonText}>+ 새 지점 추가</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F8FAFC',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    helperText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },
    companyCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    companyInfo: {
        flex: 1,
    },
    companyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    companyAddress: {
        fontSize: 13,
        color: '#64748B',
    },
    editButton: {
        fontSize: 15,
        color: '#4F46E5',
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 40,
    },
    addButton: {
        backgroundColor: '#4F46E5',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
