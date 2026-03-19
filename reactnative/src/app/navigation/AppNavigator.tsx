import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useAuth} from '@clerk/clerk-expo';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../context/ThemeContext';

// Auth screens
import SignInScreen from '../../ui/screens/auth/SignInScreen';
import SignUpScreen from '../../ui/screens/auth/SignUpScreen';

// Tab screens
import HomeScreen from '../../ui/screens/tabs/HomeScreen';
import TransactionsScreen from '../../ui/screens/tabs/TransactionsScreen';
import WorkflowsScreen from '../../ui/screens/tabs/WorkflowsScreen';
import ProfileScreen from '../../ui/screens/tabs/ProfileScreen';

// Modal screens
import AddTransactionScreen from '../../ui/screens/AddTransactionScreen';
import AddWorkflowScreen from '../../ui/screens/AddWorkflowScreen';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

// ─── Auth Navigator ───
function AuthNavigator() {
  const {colors} = useTheme();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: colors.background},
      }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Tab Navigator ───
function TabNavigator() {
  const {colors, isDark} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({color, size}) => {
          let iconName = 'home';
          switch (route.name) {
            case 'HomeTab':
              iconName = 'home';
              break;
            case 'TransactionsTab':
              iconName = 'receipt';
              break;
            case 'WorkflowsTab':
              iconName = 'flash';
              break;
            case 'ProfileTab':
              iconName = 'person';
              break;
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{title: 'Home'}}
      />
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsScreen}
        options={{title: 'Transactions'}}
      />
      <Tab.Screen
        name="WorkflowsTab"
        component={WorkflowsScreen}
        options={{title: 'Workflows'}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{title: 'Profile'}}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigator with Auth Guard ───
export default function AppNavigator() {
  const {isLoaded, isSignedIn} = useAuth();
  const {colors} = useTheme();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: {fontFamily: 'System', fontWeight: 'normal' as const},
          medium: {fontFamily: 'System', fontWeight: '500' as const},
          bold: {fontFamily: 'System', fontWeight: 'bold' as const},
          heavy: {fontFamily: 'System', fontWeight: '900' as const},
        },
      }}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {isSignedIn ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={({}) => ({
                headerShown: true,
                title: 'Add Transaction',
                presentation: 'modal',
                headerStyle: {backgroundColor: colors.background},
                headerTintColor: colors.text,
                headerShadowVisible: false,
              })}
            />
            <Stack.Screen
              name="AddWorkflow"
              component={AddWorkflowScreen}
              options={{
                headerShown: true,
                title: 'Create Workflow',
                presentation: 'modal',
                headerStyle: {backgroundColor: colors.background},
                headerTintColor: colors.text,
                headerShadowVisible: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
