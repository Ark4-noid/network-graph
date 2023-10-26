import pandas as pd
import json
from unidecode import unidecode 

# Leer los datos
data = pd.read_excel('test1.xlsx')

# Convertir las cadenas a minúsculas y limpiarlas con unidecode
data['Categoría Principal'] = data['Categoría Principal'].str.lower().apply(unidecode)
data['Categorías Relacionadas'] = data['Categorías Relacionadas'].str.lower().apply(unidecode)
data['Palabras Clave'] = data['Palabras Clave'].str.lower().apply(unidecode)
data['Tema'] = data['Tema'].str.lower().apply(unidecode)
data['Texto del Tema'] = data['Texto del Tema'].str.lower().apply(unidecode)

# Preparar los datos
nodes = []
links = []
node_name_to_id = {}
node_counter = 1
parent_nodes_set = set(data['Categoría Principal'])

# Cambiamos el método para manejar listas de temas y textos del tema
def get_node_id(name, type, tema=None, textotema=None):
    global node_counter
    if name not in node_name_to_id:
        node_data = {'id': node_counter, 'name': name, 'type': type}
        
        if type == 'parent':
            # Aquí inicializamos 'tema' y 'textotema' como listas vacías, independientemente de si tienen valores o no
            node_data['tema'] = []
            node_data['textotema'] = []
            
            if tema and textotema:
                node_data['tema'].append(tema)
                node_data['textotema'].append(textotema)
        
        nodes.append(node_data)
        node_name_to_id[name] = node_counter
        node_counter += 1
    else:
        # Si el nodo ya existe y es de tipo 'parent', simplemente añadimos el nuevo tema y texto del tema a las listas
        if type == 'parent':
            node = next(filter(lambda x: x['id'] == node_name_to_id[name], nodes), None)
            if node:
                if tema and textotema:
                    node['tema'].append(tema)
                    node['textotema'].append(textotema)
    return node_name_to_id[name]

for idx, row in data.iterrows():
    parent_node_id = get_node_id(row['Categoría Principal'], 'parent', row['Tema'], row['Texto del Tema'])
    
    keywords = row['Palabras Clave'].split(',')
    keyword_ids = []
    for keyword in keywords:
        keyword = keyword.strip().lower()
        keyword_id = get_node_id(keyword, 'child')
        links.append({'source': parent_node_id, 'target': keyword_id})
        keyword_ids.append(keyword_id)
    
    related_categories_str = row['Categorías Relacionadas']
    if related_categories_str in parent_nodes_set:
        related_categories = [related_categories_str]
    else:
        related_categories = related_categories_str.split(',')
        
    for related_category in related_categories:
        related_category = related_category.strip().lower()
        if related_category:
            node_type = 'parent' if related_category in parent_nodes_set else 'child'
            related_category_id = get_node_id(related_category, node_type)
            for keyword_id in keyword_ids:
                links.append({'source': related_category_id, 'target': keyword_id})

# Exportar a JSON
with open('data.json', 'w') as f:
    json.dump({'nodes': nodes, 'links': links}, f, ensure_ascii=False, indent=4)
