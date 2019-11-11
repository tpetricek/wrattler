"""
Check we can read and write to the data store.
"""

import os
import pytest
import json

from wrattler_python_service.python_service_utils import read_frame, write_frame, retrieve_frames

cell_hash = 'abc123def'
frame_name = 'testframe'
if "DATASTORE_URI" in os.environ.keys():
    datastore_base_url = os.environ["DATASTORE_URI"]
else:
    datastore_base_url = 'http://localhost:7102'


@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_write_frame():
    """
    Write a frame
    """
    test_data = [
        {"var_1": "123", "var_2": "abc"},
        {"var_1": "456", "var_2": "def"}
    ]
    test_data_str = json.dumps(test_data)
    wrote_ok = write_frame(test_data_str,
                           frame_name,
                           cell_hash)
    assert(wrote_ok==True)


@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_read_frame():
    """
    Read back the same frame
    """
    data_str = read_frame(frame_name, cell_hash)
    data = json.loads(data_str)
    assert(len(data)==2)
    assert(data[0]["var_1"]=="123")
    assert(data[0]["var_2"]=="abc")
    assert(data[1]["var_1"]=="456")
    assert(data[1]["var_2"]=="def")


@pytest.mark.skipif("WRATTLER_LOCAL_TEST" in os.environ.keys(),
                    reason="Needs data-store to be running")
def test_retrieve_frames():
    """
    as used by eval function - get frames from url,
    and put contents into a dictionary.
    """
    frame_list = [{"name": "test_frame",
                   "url":  '{}/{}/{}'.format(datastore_base_url,
                                             cell_hash,
                                             frame_name)}]
    data = retrieve_frames(frame_list)
    print(data)
