use crate::models::{AppError, AppResult, AreaInput, TaskInput};
use chrono::NaiveDate;

fn text(value: &str, min: usize, max: usize, message: &'static str) -> AppResult<()> {
    let len = value.trim().chars().count();
    if len < min || len > max || value.contains('\0') {
        return Err(AppError::validation(message));
    }
    Ok(())
}

pub fn id(value: &str) -> AppResult<()> {
    if uuid::Uuid::parse_str(value).is_err() {
        return Err(AppError::validation("Identificador inválido."));
    }
    Ok(())
}

pub fn area(input: &AreaInput) -> AppResult<()> {
    if let Some(value) = &input.id {
        id(value)?;
    }
    text(
        &input.name,
        1,
        80,
        "O nome deve ter entre 1 e 80 caracteres.",
    )?;
    text(
        &input.description,
        0,
        1000,
        "A descrição deve ter até 1000 caracteres.",
    )?;
    if !["forest", "blue", "violet", "amber", "rose"].contains(&input.color.as_str()) {
        return Err(AppError::validation("Escolha uma cor válida."));
    }
    Ok(())
}

pub fn task(input: &TaskInput) -> AppResult<()> {
    if let Some(value) = &input.id {
        id(value)?;
    }
    if let Some(value) = &input.area_id {
        id(value)?;
    }
    text(
        &input.title,
        1,
        160,
        "O título deve ter entre 1 e 160 caracteres.",
    )?;
    text(
        &input.notes,
        0,
        5000,
        "As notas devem ter até 5000 caracteres.",
    )?;
    if !["low", "medium", "high"].contains(&input.priority.as_str()) {
        return Err(AppError::validation("Escolha uma prioridade válida."));
    }
    if !["todo", "doing", "done"].contains(&input.status.as_str()) {
        return Err(AppError::validation("Escolha um status válido."));
    }
    if let Some(value) = &input.due_date {
        if value.len() != 10 || NaiveDate::parse_from_str(value, "%Y-%m-%d").is_err() {
            return Err(AppError::validation("Informe uma data válida."));
        }
    }
    if input
        .estimate_minutes
        .is_some_and(|v| !(1..=1440).contains(&v))
    {
        return Err(AppError::validation(
            "A estimativa deve ser de 1 a 1440 minutos.",
        ));
    }
    Ok(())
}
