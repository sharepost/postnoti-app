import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider, useAppContent } from './src/contexts/AppContext';

// Screens
import { LandingScreen } from './src/screens/LandingScreen';
import { AdminBranchSelectScreen } from './src/screens/AdminBranchSelectScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AdminRegisterMailScreen } from './src/screens/AdminRegisterMailScreen';
import { TenantDashboard } from './src/components/tenant/TenantDashboard';
// Note: TenantDashboard is still in components, can be moved later. 
// We will wrap it in a Screen component if needed or use directly if it accepts navigation props, 
// but existing TenantDashboard uses 'onBack'. We should adapt it.

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isInitializing, mode, brandingCompany, expoPushToken, webPushToken, setMode } = useAppContent();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  // Sync 'mode' from Context to Navigation (for Deep Linking support)
  // When 'mode' changes in Context (e.g. from Deep Link), we need to navigate.
  // This is a bridge between the old 'mode' logic and new Navigation.

  // Actually, standard NavigationContainer 'linking' prop is better, 
  // but to keep logic gathered in AppContext working (which sets 'mode'), we use an effect.

  // NOTE: This creates a two-way binding or potential loop if not careful.
  // Ideally, AppContext shouldn't setMode anymore, but for safety in this refactor, we bridge it.

  useEffect(() => {
    if (isInitializing) return;

    // Initial Route determination is actually done via NavigationContainer logic usually, 
    // but here we follow the context state which might have been set by DeepLink.
  }, [isInitializing]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 15, color: '#64748B', fontSize: 13, fontWeight: '600' }}>지점 정보를 인식하고 있습니다...</Text>
      </View>
    );
  }

  // Tenant Dashboard Wrapper to adapt 'onBack'
  const TenantDashboardWrapper = ({ navigation }: any) => {
    // If brandingCompany not set, go back to Landing
    if (!brandingCompany) {
      // navigation.replace('Landing'); // Effect?
      return null;
    }
    return (
      <TenantDashboard
        companyId={brandingCompany.id}
        companyName={brandingCompany.name}
        pushToken={expoPushToken}
        webPushToken={webPushToken}
        onBack={() => {
          setMode('landing');
          navigation.popToTop();
        }}
      />
    );
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* If context says tenant_login, we effectively want to show TenantDashboard. 
            However, defining initialRouteName based on state is tricky in RN. 
            Instead, we rely on the fact that if 'mode' was set to 'tenant_login' during init, 
            we should navigate there. 
            
            Let's keep it simple: Start at Landing. 
            Context's deep link listener will triggered, setMode, and ideally we navigate.
            
            Wait, AppContext deep link logic sets 'mode'. 
            It doesn't have access to 'navigation' object.
            We need a navigator reference.
        */}
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="AdminBranchSelect" component={AdminBranchSelectScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AdminRegisterMail" component={AdminRegisterMailScreen} />

        {/* Special Case: Tenant Dashboard */}
        <Stack.Screen name="TenantDashboard" component={TenantDashboardWrapper} />
      </Stack.Navigator>

      {/* Bridge Component to handle Context-driven navigation (Deep Links) */}
      <NavigationBridge />
    </NavigationContainer>
  );
}

// Internal component to listen to Context 'mode' changes and trigger Navigation
import { useNavigation } from '@react-navigation/native';

function NavigationBridge() {
  const { mode } = useAppContent();
  const navigation = useNavigation<any>();

  useEffect(() => {
    // If mode changes to 'tenant_login', navigate to TenantDashboard
    if (mode === 'tenant_login') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TenantDashboard' }],
      });
    }
    // Deep links for 'branch' are handled in AppContext -> setMode('tenant_login') -> Here -> Navigate.

    // Other generic modes? 
    // If we manually setMode('admin_branch_select'), we might want to sync?
    // But screens now call navigation.navigate directly so this is mostly for the Deep Link start event.
  }, [mode, navigation]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
