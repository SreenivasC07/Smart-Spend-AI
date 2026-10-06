def test_project_files_exist():
    import os

    assert os.path.exists("backend/app.py")
    assert os.path.exists("frontend/index.html")
    assert os.path.exists("ml/model_parameters.json")


def test_basic_math():
    assert 2 + 2 == 4