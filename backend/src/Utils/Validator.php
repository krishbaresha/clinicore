<?php
declare(strict_types=1);

namespace CliniCore\Utils;

class Validator {
    private array $data;
    private array $errors = [];

    public function __construct(array $data) {
        $this->data = $data;
    }

    public static function make(array $data): self {
        return new self($data);
    }

    public function required(string $field, string $customMessage = ''): self {
        if (!isset($this->data[$field]) || trim((string)$this->data[$field]) === '') {
            $this->errors[$field] = $customMessage ?: "The {$field} field is required.";
        }
        return $this;
    }

    public function minLength(string $field, int $min): self {
        if (isset($this->data[$field]) && mb_strlen((string)$this->data[$field]) < $min) {
            $this->errors[$field] = "The {$field} must be at least {$min} characters.";
        }
        return $this;
    }

    public function numeric(string $field): self {
        if (isset($this->data[$field]) && !is_numeric($this->data[$field])) {
            $this->errors[$field] = "The {$field} must be a valid number.";
        }
        return $this;
    }

    public function inArray(string $field, array $allowed): self {
        if (isset($this->data[$field]) && !in_array($this->data[$field], $allowed, true)) {
            $this->errors[$field] = "The {$field} must be one of: " . implode(', ', $allowed);
        }
        return $this;
    }

    public function passes(): bool {
        return empty($this->errors);
    }

    public function fails(): bool {
        return !empty($this->errors);
    }

    public function errors(): array {
        return $this->errors;
    }

    public function validateOrFail(): array {
        if ($this->fails()) {
            Response::validationError($this->errors);
        }
        return $this->data;
    }
}
