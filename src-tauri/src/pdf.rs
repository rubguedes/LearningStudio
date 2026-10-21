//! Standard A4 PDF writer for offline Latin-script lessons, without scripts or remote resources.
use crate::models::EnglishLesson;
fn literal(s: &str) -> String {
    s.chars()
        .map(|c| {
            let byte = match c {
                '\u{2019}' => 39,
                '\u{201c}' | '\u{201d}' => 34,
                '\u{2013}' | '\u{2014}' => 45,
                c if (c as u32) <= 255 => c as u8,
                _ => b'?',
            };
            format!("\\{byte:03o}")
        })
        .collect()
}
fn width(s: &str) -> f64 {
    // Adobe Helvetica widths, in 1/1000 em. Unknown glyphs reserve a full em.
    const WIDTHS: [u16; 95] = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
        556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
        722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
        667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
        556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
        500, 334, 260, 334, 584,
    ];
    s.chars()
        .map(|c| {
            let ascii = match c {
                'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'í' | 'ì' | 'î' | 'ï' => 'i',
                'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
                'ú' | 'ù' | 'û' | 'ü' => 'u',
                'ç' => 'c',
                'ñ' => 'n',
                'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'A',
                'É' | 'È' | 'Ê' | 'Ë' => 'E',
                'Í' | 'Ì' | 'Î' | 'Ï' => 'I',
                'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'O',
                'Ú' | 'Ù' | 'Û' | 'Ü' => 'U',
                'Ç' => 'C',
                'Ñ' => 'N',
                '\u{2019}' => '\'',
                '\u{201c}' | '\u{201d}' => '"',
                '\u{2013}' | '\u{2014}' => '-',
                _ => c,
            };
            if (' '..='~').contains(&ascii) {
                WIDTHS[ascii as usize - 32] as f64 * 0.012
            } else {
                12.0
            }
        })
        .sum()
}
fn wrap(s: &str) -> Vec<String> {
    let mut lines = vec![];
    for paragraph in s.split("\n\n") {
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            let mut chunks = vec![];
            let mut chunk = String::new();
            for c in word.chars() {
                if width(&chunk) + width(&c.to_string()) > 480.0 {
                    chunks.push(std::mem::take(&mut chunk));
                }
                chunk.push(c);
            }
            chunks.push(chunk);
            for chunk in chunks {
                if width(&line) + width(&chunk) + width(" ") > 480.0 {
                    lines.push(std::mem::take(&mut line));
                }
                if !line.is_empty() {
                    line.push(' ');
                }
                line.push_str(&chunk);
            }
        }
        lines.push(line);
        lines.push(String::new());
    }
    lines
}
pub fn lesson(lesson: &EnglishLesson) -> Vec<u8> {
    let mut lines = vec![
        "LearningStudio - Lição para anotação".into(),
        lesson.title.clone(),
        format!(
            "Nível estimado: {} | {} minutos",
            lesson.level, lesson.minutes
        ),
        format!("ID: {}", lesson.id),
        "Nome: ________________________ Data: ______________".into(),
        String::new(),
    ];
    lines.extend(wrap(&format!(
        "Objetivos: {}",
        lesson.objectives.join("; ")
    )));
    lines.push("1. Leitura".into());
    lines.extend(wrap(&lesson.reading));
    lines.push("2. Compreensão".into());
    for (i, q) in lesson.questions.iter().enumerate() {
        lines.extend(wrap(&format!("Q{}: {}", i + 1, q.prompt)));
        for (n, c) in q.choices.iter().enumerate() {
            lines.extend(wrap(&format!("{}. {}", n + 1, c)));
        }
        lines.extend([
            format!("Resposta Q{}: ____________________________________",i+1),
            String::new(),
            String::new(),
        ]);
    }
    lines.push("3. Redação - campo W1".into());
    lines.extend(wrap(&lesson.writing_prompt));
    for _ in 0..16 {
        lines.push("_________________________________________________________".into());
    }
    lines.push("4. Revisão - campo R1".into());
    lines.extend(wrap(&lesson.follow_up));
    for _ in 0..5 {
        lines.push("_________________________________________________________".into());
    }
    // Apply measured wrapping to headings too; long user-generated text must not clip.
    let lines = lines
        .into_iter()
        .flat_map(|line| {
            if width(&line) > 480.0 {
                let mut result = wrap(&line);
                while result.last().is_some_and(String::is_empty) {
                    result.pop();
                }
                result
            } else {
                vec![line]
            }
        })
        .collect::<Vec<String>>();
    let pages = lines.chunks(36).collect::<Vec<_>>();
    let mut objects = vec![
        b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(),
        vec![],
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
            .to_vec(),
    ];
    let kids = (0..pages.len())
        .map(|i| format!("{} 0 R", 4 + i * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects[1] = format!("<< /Type /Pages /Kids [{kids}] /Count {} >>", pages.len()).into_bytes();
    for (i, page) in pages.iter().enumerate() {
        let content_id = 5 + i * 2;
        objects.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>").into_bytes());
        let mut stream = String::from("BT /F1 12 Tf 50 780 Td 18 TL\n");
        for line in *page {
            stream.push_str(&format!("({}) Tj T*\n", literal(line)));
        }
        stream.push_str(&format!(
            "ET BT /F1 9 Tf 50 36 Td (LearningStudio | {} / {} | PDF padrao A4) Tj ET",
            i + 1,
            pages.len()
        ));
        objects.push(
            format!(
                "<< /Length {} >>\nstream\n{}\nendstream",
                stream.len(),
                stream
            )
            .into_bytes(),
        );
    }
    let mut result = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0];
    for (i, object) in objects.iter().enumerate() {
        offsets.push(result.len());
        result.extend_from_slice(format!("{} 0 obj\n", i + 1).as_bytes());
        result.extend_from_slice(object);
        result.extend_from_slice(b"\nendobj\n");
    }
    let xref = result.len();
    result
        .extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", offsets.len()).as_bytes());
    for offset in offsets.iter().skip(1) {
        result.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    result.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
            offsets.len()
        )
        .as_bytes(),
    );
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn standard_pdf_has_pages_fields_and_correct_offsets() {
        let lessons: Vec<EnglishLesson> =
            serde_json::from_str(include_str!("../content/english.json")).unwrap();
        let bytes = lesson(&lessons[0]);
        let text = String::from_utf8(bytes.clone()).unwrap();
        assert!(text.starts_with("%PDF-1.4"));
        assert!(text.contains("/MediaBox [0 0 595.276 841.89]"));
        assert!(text.contains("/Count "));
        if let Ok(path) = std::env::var("LEARNINGSTUDIO_PDF_FIXTURE") {
            std::fs::write(path, bytes).unwrap();
        }
        let xref: usize = text
            .split("startxref\n")
            .nth(1)
            .unwrap()
            .lines()
            .next()
            .unwrap()
            .parse()
            .unwrap();
        assert!(text[xref..].starts_with("xref"));
    }
}
