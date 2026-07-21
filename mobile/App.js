"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const AppNavigator_1 = __importDefault(require("./src/navigation/AppNavigator"));
const useAuthStore_1 = require("./src/store/useAuthStore");
const colors_1 = require("./src/theme/colors");
function AppContent() {
    const { isLoading, loadToken } = (0, useAuthStore_1.useAuthStore)();
    (0, react_1.useEffect)(() => {
        loadToken();
    }, []);
    if (isLoading) {
        return (<react_native_1.View style={styles.splash}>
        <react_native_1.View style={styles.logoRing}>
          <vector_icons_1.Ionicons name="link" size={36} color={colors_1.colors.primary}/>
        </react_native_1.View>
        <react_native_1.Text style={styles.splashTitle}>OneLink</react_native_1.Text>
        <react_native_1.Text style={styles.splashSub}>Smart City Super App</react_native_1.Text>
        <react_native_1.ActivityIndicator color={colors_1.colors.primary} size="small" style={styles.loader}/>
      </react_native_1.View>);
    }
    return <AppNavigator_1.default />;
}
function App() {
    return (<react_native_safe_area_context_1.SafeAreaProvider>
      <react_native_1.StatusBar barStyle="light-content" backgroundColor={colors_1.colors.background}/>
      <AppContent />
    </react_native_safe_area_context_1.SafeAreaProvider>);
}
const styles = react_native_1.StyleSheet.create({
    splash: {
        flex: 1,
        backgroundColor: colors_1.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors_1.colors.primaryGlow,
        borderWidth: 1,
        borderColor: colors_1.colors.borderAccent,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: colors_1.spacing.lg,
    },
    splashTitle: {
        color: colors_1.colors.textPrimary,
        fontSize: colors_1.fontSize.display,
        fontWeight: '800',
        letterSpacing: 1,
    },
    splashSub: {
        color: colors_1.colors.textSecondary,
        fontSize: colors_1.fontSize.md,
        marginTop: colors_1.spacing.sm,
    },
    loader: {
        marginTop: colors_1.spacing.xl,
    },
});
