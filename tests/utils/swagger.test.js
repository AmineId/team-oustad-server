const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// yamljs (utilisé par index.js) tolère des scalaires invalides, comme une
// description non quotée contenant « : ». Les clients chargent swagger.yml
// avec des parseurs stricts : on le vérifie ici.
describe('swagger.yml', () => {
  it('est du YAML valide pour un parseur strict', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../swagger.yml'), 'utf8');
    const doc = yaml.load(source);
    expect(doc.openapi).toBe('3.0.0');
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
  });
});
