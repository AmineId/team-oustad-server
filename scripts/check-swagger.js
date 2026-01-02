const YAML = require('yamljs');
const swaggerDoc = YAML.load('./swagger.yml');

console.log('🔍 Vérification de la documentation Swagger...\n');

// Routes à vérifier
const routesToCheck = [
  { path: '/auth/send-setup-email', method: 'post', name: 'Send Setup Email' },
  { path: '/auth/setup-password', method: 'post', name: 'Setup Password' },
  { path: '/auth/login', method: 'post', name: 'Login' },
  { path: '/auth/forgot-password', method: 'post', name: 'Forgot Password' },
  { path: '/auth/reset-password', method: 'post', name: 'Reset Password' },
  { path: '/users', method: 'post', name: 'Create User' },
  { path: '/plannings/exercises/{id}', method: 'get', name: 'Get Exercise by ID' }
];

let allFound = true;

routesToCheck.forEach(route => {
  const pathExists = swaggerDoc.paths[route.path];
  const methodExists = pathExists && pathExists[route.method];
  
  if (methodExists) {
    console.log(`✅ ${route.name}: ${route.method.toUpperCase()} ${route.path}`);
    
    // Vérifier la description
    if (methodExists.description) {
      console.log(`   📝 Description: ${methodExists.description.substring(0, 60)}...`);
    }
    
    // Vérifier les tags
    if (methodExists.tags) {
      console.log(`   🏷️  Tags: ${methodExists.tags.join(', ')}`);
    }
    
  } else {
    console.log(`❌ ${route.name}: ${route.method.toUpperCase()} ${route.path} - NON TROUVÉ`);
    allFound = false;
  }
  
  console.log('');
});

if (allFound) {
  console.log('🎉 Toutes les routes sont documentées dans Swagger!\n');
  
  // Statistiques
  const totalPaths = Object.keys(swaggerDoc.paths).length;
  let totalEndpoints = 0;
  Object.values(swaggerDoc.paths).forEach(path => {
    totalEndpoints += Object.keys(path).length;
  });
  
  console.log(`📊 Statistiques Swagger:`);
  console.log(`   - Chemins uniques: ${totalPaths}`);
  console.log(`   - Total endpoints: ${totalEndpoints}`);
  console.log(`   - Schémas définis: ${Object.keys(swaggerDoc.components.schemas).length}`);
  
} else {
  console.log('⚠️  Certaines routes manquent dans la documentation Swagger');
  process.exit(1);
}
