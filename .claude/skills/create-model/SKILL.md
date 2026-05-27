---
name: create-model
description: Create a new Mongoose model with proper structure and validation
---

# Create Mongoose Model

**Scope:** Create a new Mongoose model with proper structure and validation.

This skill creates:

- Mongoose model with proper schema definition
- Validation using Zod
- Proper type definitions
- Export for use in controllers

## Usage

```
/create-model <model-name>
```

Example:

```
/create-model user
```

## Model Structure

Create a model file with the following structure:

```ts
import { Schema, model } from "mongoose";

const DB_NAME = "{{ModelName}}";  //PascalCase, singular
const COLLECTION_NAME = "Users";  //PascalCase, plural

// Mongoose schema
const {{camelCaseModelName}}Schema = new Schema(
  {
    // Fields will be added here based on input
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
);

// Export
const {{ModelName}} = mongoose.model(DB_NAME, {{camelCaseModelName}}Schema);
export default {{ModelName}};
```

## Export

Always export:

- The model instance (e.g., `User`)

## Location

Create the model in:

```
src/shared/models/<model-name>.model.ts
```

Example:

```
src/shared/models/user.model.ts
```
