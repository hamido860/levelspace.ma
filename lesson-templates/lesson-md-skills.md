---
# **Lesson MD Skills: Dynamic Template for Moroccan Curriculum**
**Objective**: Provide a **scalable, abstract Markdown template** to generate **why, how, when, and where** explanations for **any lesson** in the Moroccan curriculum, using data from `combined-ingested-pdfs.json`.

**Instructions**:
1. Replace all **placeholders** (e.g., `{{lesson_title}}`, `{{subject}}`) with actual data from your JSON file.
2. Use the **subject-specific templates** below to ensure pedagogical clarity.
3. This file is **abstract** and **not hardcoded** to any specific lesson.

---

---
## **📌 1. Dynamic Metadata Template**
Use this template for **every lesson** in your JSON file.

```markdown
# **{{lesson_title}}**
**Subject**: `{{subject}}` |
**Grade**: `{{grade}}` |
**ID**: `{{id}}` |
**Source**: [Link](`{{source_url}}`) |
**Validation Status**: `{{validation_status}}` |
**Confidence**: `{{confidence}}%`

---
```

---

---
## **🎯 2. Subject-Specific Abstract Templates**
Use the **appropriate template** based on the `subject` field from your JSON.

---
### **📖 A. Language (Français/Arabe/Anglais)**
```markdown
---
## **📌 Pourquoi cette compétence est-elle importante ?**
Cette compétence permet aux élèves de :
- **Comprendre** des textes, images, ou dialogues en `{{subject}}`.
- **Développer** leur expression orale et écrite.
- **Améliorer** leur capacité à communiquer dans des contextes variés (scolaire, social, professionnel).
- **Renforcer** leur pensée critique et créative.

**Contexte Marocain** :
Au Maroc, cette compétence est essentielle pour :
- Réussir les **évaluations nationales** en `{{subject}}`.
- Participer activement aux **discussions en classe**.
- Comprendre les **supports pédagogiques officiels** (manuels, vidéos, etc.).

---
## **🛠️ Comment utiliser cette compétence ?**
Pour maîtriser cette compétence, suivez ces étapes :
1. **Lire/Écouter** : Analyser le texte, l'image, ou le dialogue.
2. **Identifier** : Repérer les éléments clés (mots, phrases, idées principales).
3. **Comprendre** : Interpréter le sens global et les détails.
4. **Appliquer** :
   - **Expression orale** : Décrire, expliquer, ou discuter en `{{subject}}`.
   - **Expression écrite** : Rédiger des phrases, paragraphes, ou essais.
5. **Évaluer** : Vérifier la cohérence et la précision de vos réponses.

---
## **📅 Quand utiliser cette compétence ?**

| **Contexte**          | **Exemple d'Application**                          |
|-----------------------|----------------------------------------------------|
| En classe             | Analyser un texte ou une image dans le manuel.    |
| À la maison           | Lire un livre ou décrire une scène d'un film.      |
| Examens               | Répondre à des questions de compréhension.       |
| Vie quotidienne       | Communiquer avec des amis ou en famille.          |

---
## **📍 Où utiliser cette compétence ?**
- En classe de `{{subject}}`.
- Lors de la lecture de livres ou d'articles.
- En regardant des films, émissions, ou vidéos éducatives.
- Dans des contextes sociaux ou professionnels (ex. : réunions, présentations).
```

---

---
### **➗ B. Math (Mathématiques)**
```markdown
---
## **📌 Pourquoi cette compétence est-elle importante ?**
Cette compétence permet aux élèves de :
- **Résoudre** des problèmes mathématiques de manière logique.
- **Appliquer** des concepts théoriques à des situations réelles.
- **Développer** leur raisonnement critique et leur capacité à analyser des données.
- **Préparer** aux évaluations et aux défis académiques.

**Contexte Marocain** :
Au Maroc, cette compétence est cruciale pour :
- Réussir les **examens nationaux** (ex. : Bac, Brevet).
- Appliquer les maths dans des **situations quotidiennes** (budgets, achats, mesures).
- Comprendre les **concepts fondamentaux** du programme officiel.

---
## **🛠️ Comment utiliser cette compétence ?**
Pour résoudre un problème mathématique :
1. **Lire** : Comprendre l'énoncé du problème.
2. **Identifier** :
   - Les **données** (nombres, unités, relations).
   - Ce qui est **demandé** (inconnue à trouver).
3. **Choisir** : Sélectionner la méthode ou la formule appropriée.
4. **Appliquer** :
   - Effectuer les calculs étape par étape.
   - Vérifier les unités et les opérations.
5. **Vérifier** :
   - Relire l'énoncé pour s'assurer que la réponse est cohérente.
   - Vérifier les calculs et les résultats.

---
## **📅 Quand utiliser cette compétence ?**

| **Contexte**          | **Exemple d'Application**                          |
|-----------------------|----------------------------------------------------|
| En classe             | Résoudre des exercices du manuel.                 |
| Devoirs à la maison   | Faire des problèmes supplémentaires.               |
| Examens               | Réussir les questions de maths.                   |
| Vie quotidienne       | Calculer un budget, des pourcentages, ou des mesures. |

---
## **📍 Où utiliser cette compétence ?**
- En classe de maths.
- Lors de la préparation aux examens.
- Dans des contextes pratiques (ex. : achats, construction, cuisine).
- Dans des projets scientifiques ou techniques.
```

---

---
### **⚗ C. Physics (Sciences Physiques)**
```markdown
---
## **📌 Pourquoi cette compétence est-elle importante ?**
Cette compétence permet aux élèves de :
- **Comprendre** les lois et phénomènes physiques.
- **Expérimenter** et observer des résultats concrets.
- **Développer** leur esprit scientifique et leur capacité à résoudre des problèmes.
- **Appliquer** les connaissances théoriques à des situations pratiques.

**Contexte Marocain** :
Au Maroc, cette compétence est essentielle pour :
- Réussir les **évaluations en sciences** (ex. : Bac Scientifique).
- Comprendre les **applications technologiques** (énergie, électronique, etc.).
- Participer à des **projets scientifiques** ou des concours.

---
## **🛠️ Comment utiliser cette compétence ?**
Pour maîtriser un concept en physique :
1. **Observer** : Étudier le phénomène ou l'expérience.
2. **Formuler une hypothèse** : Prédire ce qui pourrait se passer.
3. **Expérimenter** :
   - Suivre les étapes de l'expérience.
   - Mesurer et enregistrer les données.
4. **Analyser** :
   - Comparer les résultats avec l'hypothèse.
   - Tirer des conclusions.
5. **Appliquer** :
   - Utiliser les conclusions pour résoudre des problèmes similaires.
   - Relier les résultats à des applications réelles.

---
## **📅 Quand utiliser cette compétence ?**

| **Contexte**          | **Exemple d'Application**                          |
|-----------------------|----------------------------------------------------|
| En classe             | Réaliser une expérience en labo.                  |
| Devoirs à la maison   | Résoudre des exercices théoriques.                |
| Examens               | Répondre à des questions sur les lois physiques.|
| Vie quotidienne       | Comprendre le fonctionnement d'un appareil électrique. |

---
## **📍 Où utiliser cette compétence ?**
- En classe de physique ou en laboratoire.
- Lors de visites éducatives (ex. : musées scientifiques).
- Dans des projets de recherche ou des concours.
- Dans des contextes techniques (ex. : réparation, ingénierie).
```

---

---
### **📚 D. Default Template (Fallback for Unknown Subjects)**
```markdown
---
## **📌 Pourquoi cette compétence est-elle importante ?**
Cette compétence est importante pour le **programme marocain** et permet aux élèves de :
- Développer des **compétences transversales**.
- Appliquer les connaissances dans des **contextes variés**.

---
## **🛠️ Comment utiliser cette compétence ?**
Suivez les instructions dans la leçon et appliquez les concepts appris.

---
## **📅 Quand utiliser cette compétence ?**

| **Contexte**          | **Exemple d'Application**                          |
|-----------------------|----------------------------------------------------|
| En classe             | Participer aux activités proposées.              |
| À la maison           | Réviser et pratiquer les concepts.                |

---
## **📍 Où utiliser cette compétence ?**
- En classe.
- À la maison.
- Dans des contextes éducatifs ou pratiques.
```

---

---
## **📚 3. Lesson Content Template**
Use this template to **dynamically insert the lesson content** from `extracted_text` in your JSON file.

```markdown
---
## **📚 Contenu de la Leçon**

### **Objectifs**
- {{objective_1}}
- {{objective_2}}

### **Instructions**
{{extracted_text}}

---
## **🎯 Critères d'Évaluation**

| **Critère**               | **Oui** | **Non** |
|---------------------------|---------|---------|
| {{criteria_1}}           |         |         |
| {{criteria_2}}           |         |         |

---
## **💡 Conseils pour les Élèves**
- {{tip_1}}
- {{tip_2}}

---
## **📝 Notes pour l'Enseignant**
- **Objectifs Pédagogiques** :
  - {{pedagogical_goal_1}}
  - {{pedagogical_goal_2}}
- **Activités Suggérées** :
  - {{activity_1}}
  - {{activity_2}}
- **Différenciation** :
  - **Pour les élèves en difficulté** : {{support_tip}}
  - **Pour les élèves avancés** : {{challenge_tip}}
```

---

---
## **📌 4. Complete Lesson Structure**
Combine the **metadata**, **subject-specific abstract**, and **lesson content** templates to create a **complete Markdown file** for each lesson.

```markdown
# **{{lesson_title}}**
**Subject**: `{{subject}}` |
**Grade**: `{{grade}}` |
**ID**: `{{id}}` |
**Source**: [Link](`{{source_url}}`)

---
{{subject_abstract}}

---
## **📚 Contenu de la Leçon**
{{lesson_content}}

---
## **🔗 Ressources Complémentaires**
- **Manuels Scolaires** : Utilisez les manuels officiels du ministère de l'Éducation marocain.
- **Sites Web** : [AlloSchool](`{{source_url}}`)
```

---

---
## **📥 5. How to Use This File**
1. **Replace Placeholders**:
   - Use data from your JSON file to replace all `{{placeholders}}` (e.g., `{{lesson_title}}`, `{{subject}}`).

2. **Select Subject Template**:
   - Choose the **subject-specific abstract template** (Language, Math, Physics, or Default) based on the `subject` field in your JSON.

3. **Generate MD Files**:
   - For each lesson in your JSON file, create a **separate Markdown file** using the combined template.

4. **Automate with Code** (Optional):
   Use the following **Python script** to generate MD files for all lessons:

   ```python
   import json

   # Load JSON data
   with open('combined-ingested-pdfs.json', 'r', encoding='utf-8') as file:
       lessons = json.load(file)

   # Subject-specific abstracts
   subject_abstracts = {
       "francais": """
   ---
   ## **📌 Pourquoi cette compétence est-elle importante ?**
   Cette compétence permet aux élèves de comprendre des scènes visuelles...
   """,
       "maths": """
   ---
   ## **📌 Pourquoi cette compétence est-elle importante ?**
   Cette compétence permet aux élèves de résoudre des problèmes mathématiques...
   """,
       # Add more subjects as needed
   }

   # Default abstract
   default_abstract = """
   ---
   ## **📌 Pourquoi cette compétence est-elle importante ?**
   Cette compétence est importante pour le programme marocain...
   """

   # Generate MD for each lesson
   for lesson in lessons:
       subject = lesson["classification"]["subject"].lower()
       abstract = subject_abstracts.get(subject, default_abstract)

       md_content = f"""
   # **{lesson['classification']['topic_title']}**
   **Subject**: {lesson['classification']['subject']} |
   **Grade**: {lesson['classification']['grade']} |
   **ID**: {lesson['id']} |
   **Source**: [Link]({lesson['source_url']})

   {abstract}

   ---
   ## **📚 Contenu de la Leçon**
   {lesson['extracted_text']}
   """

       # Save to MD file
       with open(f"{lesson['id']}.md", "w", encoding="utf-8") as f:
           f.write(md_content)
   ```

---

---
## **📌 6. Key Features**
1. **Abstract and Dynamic**: No hardcoding; uses **placeholders** for JSON data.
2. **Subject-Specific**: Templates for **Language, Math, Physics**, and a **default fallback**. 
3. **Scalable**: Works for **any lesson** in your JSON file.
4. **Pedagogically Sound**: Explains **why, how, when, and where** for each skill.
5. **Moroccan Curriculum Aligned**: Ties lessons to the **official program**.

---
## **📥 Downloadable File**
You can **download the complete template** as a single Markdown file.

---
## **📌 Summary**
This **Markdown template** provides:
1. **Dynamic subject-specific abstracts** (Language, Math, Physics).
2. **Clear structure** for **why, how, when, and where**. 
3. **Scalability** for all lessons in your JSON file.
4. **Alignment with the Moroccan curriculum**.
