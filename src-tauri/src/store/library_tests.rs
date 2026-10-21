use super::tests::{password, store};
use super::*;
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn submission(lesson_id: String, id: String, submit: bool, writing: &str) -> LibraryAction {
    LibraryAction::SaveSubmission {
        id,
        lesson_id,
        writing: writing.into(),
        answers: vec![Some(1), Some(0), Some(2)],
        submit,
    }
}
#[test]
fn seeds_are_editable_offline_and_not_recreated() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("library.db");
    let mut s = Store::open(&path).unwrap();
    s.setup_password(password()).unwrap();
    let library = s.library_snapshot().unwrap();
    assert_eq!(library.roadmaps.len(), 2);
    assert_eq!(library.lessons.len(), 2);
    assert_eq!(
        library
            .roadmaps
            .iter()
            .map(|r| r.items.len())
            .sum::<usize>(),
        13
    );
    assert!(s
        .snapshot()
        .unwrap()
        .checkpoints
        .iter()
        .all(|c| c.completed_at.is_none()));
    let removed = library.roadmaps[0].id.clone();
    s.library_action(LibraryAction::DeleteRoadmap {
        id: removed.clone(),
    })
    .unwrap();
    drop(s);
    let mut s = Store::open(&path).unwrap();
    s.unlock(password()).unwrap();
    assert_eq!(s.library_snapshot().unwrap().roadmaps.len(), 1);
    assert_eq!(s.snapshot().unwrap().checkpoints.len(), 13);
}
#[test]
fn reordering_checks_membership_and_duplicates_atomically() {
    let mut s = store();
    let roadmap = s.library_snapshot().unwrap().roadmaps.remove(0);
    let mut reversed = roadmap.items.clone();
    reversed.reverse();
    s.library_action(LibraryAction::Reorder {
        roadmap_id: roadmap.id.clone(),
        ids: reversed.clone(),
    })
    .unwrap();
    assert!(s
        .library_action(LibraryAction::Reorder {
            roadmap_id: roadmap.id.clone(),
            ids: vec![reversed[0].clone(); reversed.len()]
        })
        .is_err());
    assert_eq!(
        s.library_snapshot()
            .unwrap()
            .roadmaps
            .into_iter()
            .find(|r| r.id == roadmap.id)
            .unwrap()
            .items,
        reversed
    );
}
#[test]
fn finalized_original_is_immutable_and_review_is_separate() {
    let mut s = store();
    let lesson = s.library_snapshot().unwrap().lessons.remove(0);
    let attempt = id();
    s.library_action(submission(
        lesson.id.clone(),
        attempt.clone(),
        false,
        "draft",
    ))
    .unwrap();
    s.library_action(submission(
        lesson.id.clone(),
        attempt.clone(),
        true,
        "Original with valid alternatives.",
    ))
    .unwrap();
    assert!(s
        .library_action(submission(lesson.id, attempt.clone(), true, "Overwrite"))
        .is_err());
    s.library_action(LibraryAction::SaveReview {
        submission_id: attempt,
        difficulties: "Review contrast connectors".into(),
        revised_writing: "Separate revision".into(),
        next_review: chrono::Local::now().date_naive().to_string(),
    })
    .unwrap();
    let data = s.library_snapshot().unwrap();
    assert_eq!(
        data.submissions[0].writing,
        "Original with valid alternatives."
    );
    assert_eq!(data.reviews[0].revised_writing, "Separate revision");
}
#[test]
fn answers_and_empty_submissions_are_validated() {
    let mut s = store();
    let lesson = s.library_snapshot().unwrap().lessons.remove(0);
    assert!(s
        .library_action(submission(lesson.id.clone(), id(), true, " "))
        .is_err());
    assert!(s
        .library_action(LibraryAction::SaveSubmission {
            id: id(),
            lesson_id: lesson.id,
            writing: "A considered answer".into(),
            answers: vec![Some(99)],
            submit: true
        })
        .is_err());
    assert!(s.library_snapshot().unwrap().submissions.is_empty());
}
#[test]
fn vocabulary_deduplicates_and_reviews_are_idempotent() {
    let mut s = store();
    let word = id();
    s.library_action(LibraryAction::SaveWord {
        id: word.clone(),
        term: " assumption ".into(),
        meaning: "suposição".into(),
        example: "An assumption".into(),
    })
    .unwrap();
    assert!(s
        .library_action(LibraryAction::SaveWord {
            id: id(),
            term: "ASSUMPTION".into(),
            meaning: "duplicata".into(),
            example: "".into()
        })
        .is_err());
    let review = id();
    s.library_action(LibraryAction::ReviewWord {
        id: word.clone(),
        remembered: true,
        review_id: review.clone(),
    })
    .unwrap();
    s.library_action(LibraryAction::ReviewWord {
        id: word.clone(),
        remembered: true,
        review_id: review,
    })
    .unwrap();
    assert!(s
        .library_action(LibraryAction::ReviewWord {
            id: word,
            remembered: true,
            review_id: id()
        })
        .is_err());
    let word = s.library_snapshot().unwrap().vocabulary.remove(0);
    assert_eq!(word.reviews, 1);
    assert_eq!(word.stage, 1);
    assert_eq!(
        word.due_date,
        (chrono::Local::now().date_naive() + chrono::Days::new(1)).to_string()
    );
}
#[test]
fn library_commands_require_authentication() {
    let mut s = store();
    s.lock().unwrap();
    assert_eq!(s.library_snapshot().unwrap_err().code, "LOCKED");
    assert_eq!(
        s.library_action(LibraryAction::DeleteRoadmap { id: id() })
            .unwrap_err()
            .code,
        "LOCKED"
    );
}
#[test]
fn installed_lessons_have_consistent_answers_and_original_readings() {
    let mut s = store();
    for lesson in s.library_snapshot().unwrap().lessons {
        assert!(lesson.reading.split_whitespace().count() > 200);
        assert!(lesson
            .questions
            .iter()
            .all(|q| q.answer < q.choices.len() && !q.explanation.is_empty()));
        assert!(!lesson.rubric.is_empty());
        assert!(!lesson.reference.is_empty());
        assert!(!lesson.follow_up.is_empty());
    }
}
