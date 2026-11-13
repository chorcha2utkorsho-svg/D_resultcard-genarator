import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'server.ts', '*.config.*', '*.json', 'DRAFT_firestore.rules'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
